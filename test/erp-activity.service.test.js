const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  DEFAULT_CACHE_TTL_SECONDS,
  ErpActivityService,
  activitiesCacheKey,
  readCacheTtl,
} = require('../src/integrations/erp/erp-activity.service');

class MemoryCache {
  constructor() {
    this.values = new Map();
    this.now = 0;
    this.lastTtl = undefined;
  }

  async get(key) {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds) {
    this.lastTtl = ttlSeconds;
    this.values.set(key, { value, expiresAt: this.now + ttlSeconds * 1000 });
  }
}

const activitiesResponse = {
  data: [{
    id: 'ACT-1',
    name: 'Sopa Fraterna',
    instituteId: 'INST-1',
    status: 'ACTIVE',
    schedules: [{ id: 'SCH-1', dayOfWeek: 1, startTime: '18:00', endTime: '20:00' }],
  }],
  meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
};

test('activity list cache miss calls the ERP and stores the response with the configured TTL', async () => {
  const cache = new MemoryCache();
  let erpCalls = 0;
  let receivedParams;
  const service = new ErpActivityService({
    cache,
    cacheTtlSeconds: 120,
    erpClient: {
      getActivities: async (params) => { erpCalls += 1; receivedParams = params; return activitiesResponse; },
      getActivityById: async () => activitiesResponse.data[0],
    },
  });

  assert.deepEqual(await service.getActivities(), activitiesResponse);
  assert.equal(erpCalls, 1);
  assert.deepEqual(receivedParams, { page: 1, pageSize: 50, filters: {} });
  assert.equal(cache.lastTtl, 120);
});

test('activity list cache hit avoids another ERP request', async () => {
  const cache = new MemoryCache();
  let erpCalls = 0;
  const service = new ErpActivityService({
    cache,
    erpClient: {
      getActivities: async () => { erpCalls += 1; return activitiesResponse; },
      getActivityById: async () => activitiesResponse.data[0],
    },
  });

  const first = await service.getActivities({ page: 1, filters: { status: 'ACTIVE', instituteId: 'INST-1' } });
  const second = await service.getActivities({ page: 1, filters: { instituteId: 'INST-1', status: 'ACTIVE' } });
  assert.deepEqual(first, second);
  assert.equal(erpCalls, 1);
  assert.equal(
    activitiesCacheKey({ filters: { status: 'ACTIVE', instituteId: 'INST-1' } }),
    activitiesCacheKey({ filters: { instituteId: 'INST-1', status: 'ACTIVE' } }),
  );
});

test('expired list cache entry is fetched again from the ERP', async () => {
  const cache = new MemoryCache();
  let erpCalls = 0;
  const service = new ErpActivityService({
    cache,
    cacheTtlSeconds: 5,
    erpClient: {
      getActivities: async () => { erpCalls += 1; return activitiesResponse; },
      getActivityById: async () => activitiesResponse.data[0],
    },
  });

  await service.getActivities();
  cache.now += 5001;
  await service.getActivities();
  assert.equal(erpCalls, 2);
});

test('schedule validation uses ERP-owned schedule IDs', async () => {
  const service = new ErpActivityService({
    cache: new MemoryCache(),
    erpClient: {
      getActivities: async () => activitiesResponse,
      getActivityById: async () => activitiesResponse.data[0],
    },
  });

  assert.equal(await service.validateScheduleIds('ACT-1', ['SCH-1']), true);
  assert.equal(await service.validateScheduleIds('ACT-1', ['SCH-1', 'SCH-999']), false);
  assert.equal(await service.validateScheduleIds('ACT-1', []), true);
  assert.equal(await service.validateScheduleIds('ACT-1', 'SCH-1'), false);
});

test('ERP cache TTL defaults to five minutes and rejects invalid configuration', () => {
  assert.equal(readCacheTtl(undefined), DEFAULT_CACHE_TTL_SECONDS);
  assert.equal(readCacheTtl('45'), 45);
  assert.throws(() => readCacheTtl('0'), /positive integer/);
  assert.throws(() => readCacheTtl('not-a-number'), /positive integer/);
});
