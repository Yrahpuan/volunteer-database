const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { handleRequest } = require('../src/app');
const { RedisCrmIdempotencyStore } = require('../src/integrations/crm/idempotency-store');
const { createCrmVolunteerService, validatePayload } = require('../src/integrations/crm/crm-volunteer.service');

const payload = {
  crmPersonId: 'CRM-000123', fullName: 'Maria da Silva', cpf: '52998224725',
  email: 'maria@example.test', phone: '+5511999999999', birthDate: '1990-04-12',
  address: { city: 'São Paulo', state: 'SP' }, volunteerType: 'REGISTERED_MEMBER',
  source: 'CRM', occurredAt: '2026-09-23T10:00:00Z',
};

class MemoryRedis {
  values = new Map();
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value, options = {}) {
    if (options.NX && this.values.has(key)) return null;
    if (options.XX && !this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
}

function fakePrisma() {
  const volunteers = new Map();
  const audits = [];
  const tx = {
    volunteer: {
      findUnique: async ({ where }) => [...volunteers.values()].find((item) => item.crmPersonId === where.crmPersonId || item.cpf === where.cpf) ?? null,
      create: async ({ data }) => {
        const item = { id: 'volunteer-1', ...data, createdAt: new Date('2026-09-23T10:00:00Z') };
        volunteers.set(item.id, item);
        return item;
      },
      update: async ({ where, data }) => {
        const item = { ...volunteers.get(where.id), ...data };
        volunteers.set(where.id, item);
        return item;
      },
    },
    auditLog: { create: async ({ data }) => { audits.push(data); } },
  };
  return { $transaction: (work) => work(tx), volunteers, audits };
}

function makeResponse() {
  return {
    headersSent: false,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; this.headersSent = true; },
    end(body) { this.body = body; },
    destroy() {},
  };
}

async function call(payloadText, headers = {}, { prisma = fakePrisma(), redis = new MemoryRedis() } = {}) {
  const request = new EventEmitter();
  request.method = 'POST';
  request.url = '/api/integrations/crm/volunteers';
  request.headers = headers;
  request.setEncoding = () => {};
  const response = makeResponse();
  const service = createCrmVolunteerService({ prisma, idempotencyStore: new RedisCrmIdempotencyStore(redis) });
  const finished = handleRequest(request, response, { prisma: { $queryRaw: async () => [] }, crmVolunteerService: service, crmIntegrationToken: 'test-secret' });
  request.emit('data', payloadText);
  request.emit('end');
  await finished;
  return { response, prisma };
}

test('CRM payload validator accepts the documented shape and rejects missing fields', () => {
  assert.deepEqual(validatePayload(payload), {});
  assert.ok(validatePayload({ ...payload, cpf: '123' }).cpf);
  assert.ok(validatePayload({ ...payload, volunteerType: 'UNKNOWN' }).volunteerType);
});

test('CRM endpoint rejects invalid token and missing idempotency key', async () => {
  const invalidToken = await call(JSON.stringify(payload), { authorization: 'Bearer wrong', 'idempotency-key': 'key-1' });
  assert.equal(invalidToken.response.statusCode, 401);
  const missingKey = await call(JSON.stringify(payload), { authorization: 'Bearer test-secret' });
  assert.equal(missingKey.response.statusCode, 400);
});

test('CRM endpoint creates volunteer, records audit metadata, then replays idempotently', async () => {
  const prisma = fakePrisma();
  const redis = new MemoryRedis();
  const service = createCrmVolunteerService({ prisma, idempotencyStore: new RedisCrmIdempotencyStore(redis) });
  const first = await service(payload, 'key-1');
  const replay = await service(payload, 'key-1');
  assert.equal(first.status, 201);
  assert.equal(replay.body.id, first.body.id);
  assert.equal(replay.replay, true);
  assert.equal(prisma.volunteers.size, 1);
  assert.equal(prisma.audits[0].metadata.source, 'CRM');
});

test('CRM HTTP endpoint creates a volunteer and returns the documented response shape', async () => {
  const { response } = await call(JSON.stringify(payload), {
    authorization: 'Bearer test-secret', 'idempotency-key': 'http-key-1', 'content-type': 'application/json',
  });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(JSON.parse(response.body), {
    id: 'volunteer-1', crmPersonId: 'CRM-000123', cpf: '52998224725',
    fullName: 'Maria da Silva', volunteerType: 'REGISTERED_MEMBER', createdAt: '2026-09-23T10:00:00.000Z',
  });
});

test('same idempotency key with a different payload is rejected', async () => {
  const service = createCrmVolunteerService({ prisma: fakePrisma(), idempotencyStore: new RedisCrmIdempotencyStore(new MemoryRedis()) });
  await service(payload, 'key-1');
  await assert.rejects(() => service({ ...payload, fullName: 'Different name' }, 'key-1'), { code: 'IDEMPOTENCY_KEY_CONFLICT' });
});

test('CRM upsert uses CPF when CRM ID is new and rejects a conflicting CRM association', async () => {
  const prisma = fakePrisma();
  const service = createCrmVolunteerService({ prisma, idempotencyStore: new RedisCrmIdempotencyStore(new MemoryRedis()) });
  await service(payload, 'key-1');
  await assert.rejects(() => service({ ...payload, fullName: 'Maria Atualizada', crmPersonId: 'CRM-000999' }, 'key-2'), { code: 'CRM_PERSON_CONFLICT' });
  const update = await service({ ...payload, fullName: 'Maria Atualizada' }, 'key-3');
  assert.equal(update.status, 200);
  assert.equal(prisma.volunteers.size, 1);
  assert.equal(update.body.fullName, 'Maria Atualizada');
});
