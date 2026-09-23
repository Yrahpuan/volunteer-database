const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createErpActivityService } = require('../src/integrations/erp/create-erp-activity-service');

test('factory reads provisional ERP route and TTL config while allowing auth headers to be injected', async () => {
  const calls = [];
  const saved = new Map();
  const service = createErpActivityService({
    env: {
      ERP_BASE_URL: 'https://erp.example.test',
      ERP_ACTIVITIES_PATH: '/v2/activities',
      ERP_ACTIVITY_BY_ID_PATH: '/v2/activities/:id',
      ERP_ACTIVITIES_CACHE_TTL_SECONDS: '45',
    },
    headers: { Authorization: 'Prototype ERP credential' },
    redisClient: {
      get: async (key) => saved.get(key) ?? null,
      set: async (key, value, options) => {
        calls.push({ type: 'cache-set', options });
        saved.set(key, value);
      },
    },
    fetchImpl: async (url, options) => {
      calls.push({ type: 'fetch', url, options });
      return {
        ok: true,
        json: async () => ({ data: [], meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 } }),
      };
    },
  });

  await service.getActivities();

  const fetchCall = calls.find(({ type }) => type === 'fetch');
  assert.equal(fetchCall.url.pathname, '/v2/activities');
  assert.equal(fetchCall.url.searchParams.get('page'), '1');
  assert.equal(fetchCall.url.searchParams.get('pageSize'), '50');
  assert.deepEqual(fetchCall.options.headers, { Authorization: 'Prototype ERP credential' });
  assert.deepEqual(calls.find(({ type }) => type === 'cache-set').options, { EX: 45 });
});

test('factory requires an ERP base URL', () => {
  assert.throws(() => createErpActivityService({ env: {}, redisClient: {} }), /ERP_BASE_URL is required/);
});
