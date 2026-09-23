const { createHash } = require('node:crypto');

class CrmServiceError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

function cleanCpf(value) {
  return value.replace(/\D/g, '');
}

function validatePayload(payload) {
  const fields = {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { body: 'Expected a JSON object' };
  }
  const requiredStrings = ['crmPersonId', 'fullName', 'cpf'];
  for (const field of requiredStrings) {
    if (typeof payload[field] !== 'string' || !payload[field].trim()) fields[field] = 'Required string';
  }
  if (typeof payload.cpf === 'string' && !/^\d{11}$/.test(cleanCpf(payload.cpf))) {
    fields.cpf = 'Expected a CPF with 11 digits';
  }
  if (!['REGISTERED_MEMBER', 'EFFECTIVE_MEMBER'].includes(payload.volunteerType)) {
    fields.volunteerType = 'Unsupported volunteer type';
  }
  if (payload.source !== 'CRM') fields.source = 'Expected CRM';
  if (typeof payload.occurredAt !== 'string' || Number.isNaN(Date.parse(payload.occurredAt))) {
    fields.occurredAt = 'Expected an ISO 8601 timestamp';
  }
  for (const field of ['email', 'phone']) {
    if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== 'string') {
      fields[field] = 'Expected a string or null';
    }
  }
  if (payload.birthDate !== undefined && payload.birthDate !== null &&
      (typeof payload.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.birthDate) ||
       Number.isNaN(Date.parse(`${payload.birthDate}T00:00:00Z`)))) {
    fields.birthDate = 'Expected an ISO calendar date or null';
  }
  if (payload.address !== undefined && payload.address !== null) {
    if (typeof payload.address !== 'object' || Array.isArray(payload.address)) fields.address = 'Expected an object or null';
    else {
      for (const field of ['street', 'number', 'complement', 'neighborhood', 'city', 'state', 'postalCode']) {
        const value = payload.address[field];
        if (value !== undefined && value !== null && typeof value !== 'string') fields[`address.${field}`] = 'Expected a string or null';
      }
    }
  }
  return fields;
}

function volunteerData(payload) {
  const data = {
    crmPersonId: payload.crmPersonId.trim(),
    fullName: payload.fullName.trim(),
    cpf: cleanCpf(payload.cpf),
    volunteerType: payload.volunteerType,
  };
  for (const field of ['email', 'phone']) if (payload[field] !== undefined) data[field] = payload[field];
  if (payload.birthDate !== undefined) data.birthDate = payload.birthDate === null ? null : new Date(`${payload.birthDate}T00:00:00.000Z`);
  if (payload.address !== undefined) {
    const address = payload.address;
    for (const [source, target] of Object.entries({ street: 'street', number: 'number', complement: 'complement', neighborhood: 'neighborhood', city: 'city', state: 'state', postalCode: 'postalCode' })) {
      if (address === null) data[target] = null;
      else if (address[source] !== undefined) data[target] = address[source];
    }
  }
  return data;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function upsertVolunteer(prisma, payload) {
  const data = volunteerData(payload);
  return prisma.$transaction(async (tx) => {
    const [byCrmId, byCpf] = await Promise.all([
      tx.volunteer.findUnique({ where: { crmPersonId: data.crmPersonId } }),
      tx.volunteer.findUnique({ where: { cpf: data.cpf } }),
    ]);
    if (byCrmId && byCpf && byCrmId.id !== byCpf.id) {
      throw new CrmServiceError(409, 'CRM_PERSON_CONFLICT', 'CRM person is already associated with another volunteer');
    }
    const existing = byCrmId || byCpf;
    if (existing && existing.crmPersonId && existing.crmPersonId !== data.crmPersonId) {
      throw new CrmServiceError(409, 'CRM_PERSON_CONFLICT', 'CRM person is already associated with another volunteer');
    }
    const volunteer = existing
      ? await tx.volunteer.update({ where: { id: existing.id }, data })
      : await tx.volunteer.create({ data });
    await tx.auditLog.create({ data: {
      action: existing ? 'CRM_UPSERT_UPDATED' : 'CRM_UPSERT_CREATED',
      entity: 'Volunteer',
      entityId: volunteer.id,
      metadata: { source: payload.source, occurredAt: payload.occurredAt },
    } });
    return { status: existing ? 200 : 201, body: {
      id: volunteer.id,
      crmPersonId: volunteer.crmPersonId,
      cpf: volunteer.cpf,
      fullName: volunteer.fullName,
      volunteerType: volunteer.volunteerType,
      createdAt: volunteer.createdAt.toISOString(),
    } };
  });
}

function createCrmVolunteerService({ prisma, idempotencyStore }) {
  return async function process(payload, idempotencyKey) {
    const fields = validatePayload(payload);
    if (Object.keys(fields).length) throw new CrmServiceError(400, 'INVALID_PAYLOAD', 'Request payload is invalid', fields);
    const fingerprint = digest(payload);
    const claim = await idempotencyStore.claim(idempotencyKey, fingerprint);
    if (claim.status === 'conflict' || claim.status === 'processing') {
      throw new CrmServiceError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key is already in use');
    }
    if (claim.status === 'replay') return { ...claim.response, replay: true };
    try {
      const response = await upsertVolunteer(prisma, payload);
      await idempotencyStore.complete(idempotencyKey, fingerprint, response);
      return response;
    } catch (error) {
      await idempotencyStore.release(idempotencyKey, fingerprint);
      throw error;
    }
  };
}

module.exports = { CrmServiceError, validatePayload, volunteerData, upsertVolunteer, createCrmVolunteerService };
