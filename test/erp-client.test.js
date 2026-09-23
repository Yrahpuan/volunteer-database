const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ErpClient } = require('../src/integrations/erp/erp.client');
const { ErpIntegrationError } = require('../src/integrations/erp/erp-integration-error');

test('ERP client sends a configurable GET request with pagination and filters', async () => {
  let requestUrl;
  let requestOptions;
  const client = new ErpClient({
    baseUrl: 'https://erp.example.test',
    headers: { 'X-Prototype-Key': 'test-key' },
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return { ok: true, json: async () => ({ data: [], meta: {} }) };
    },
  });

  await client.getActivities({
    page: 2,
    pageSize: 25,
    filters: { status: 'ACTIVE', instituteId: 'INST-1' },
  });

  assert.equal(requestUrl.origin, 'https://erp.example.test');
  assert.equal(requestUrl.pathname, '/activities');
  assert.equal(requestUrl.searchParams.get('page'), '2');
  assert.equal(requestUrl.searchParams.get('pageSize'), '25');
  assert.equal(requestUrl.searchParams.get('status'), 'ACTIVE');
  assert.equal(requestUrl.searchParams.get('instituteId'), 'INST-1');
  assert.equal(requestOptions.method, 'GET');
  assert.deepEqual(requestOptions.headers, { 'X-Prototype-Key': 'test-key' });
});

test('ERP client uses the configured activity-by-ID route and encodes IDs', async () => {
  let requestUrl;
  const client = new ErpClient({
    baseUrl: 'https://erp.example.test',
    activityPath: (id) => `/custom/activities/${encodeURIComponent(id)}`,
    fetchImpl: async (url) => {
      requestUrl = url;
      return { ok: true, json: async () => ({ id: 'ACT/1', schedules: [] }) };
    },
  });

  await client.getActivityById('ACT/1');
  assert.equal(requestUrl.pathname, '/custom/activities/ACT%2F1');
});

test('ERP client maps documented HTTP errors to integration errors', async (t) => {
  const expected = [
    [401, 'ERP_UNAUTHORIZED', 401],
    [404, 'ERP_ACTIVITY_NOT_FOUND', 404],
    [503, 'ERP_UNAVAILABLE', 503],
    [500, 'ERP_UNAVAILABLE', 503],
  ];

  for (const [status, code, httpStatus] of expected) {
    await t.test(String(status), async () => {
      const client = new ErpClient({
        baseUrl: 'https://erp.example.test',
        fetchImpl: async () => ({ ok: false, status }),
      });

      await assert.rejects(client.getActivities(), (error) => {
        assert.ok(error instanceof ErpIntegrationError);
        assert.equal(error.code, code);
        assert.equal(error.httpStatus, httpStatus);
        return true;
      });
    });
  }
});

test('ERP client maps network and invalid JSON failures to ERP_UNAVAILABLE', async () => {
  const networkFailure = new ErpClient({
    baseUrl: 'https://erp.example.test',
    fetchImpl: async () => { throw new Error('connection refused'); },
  });
  const invalidJson = new ErpClient({
    baseUrl: 'https://erp.example.test',
    fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }),
  });

  for (const client of [networkFailure, invalidJson]) {
    await assert.rejects(client.getActivities(), (error) => error.code === 'ERP_UNAVAILABLE');
  }
});
