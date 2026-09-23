const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createApp, handleRequest } = require('../src/app');

function makeResponse() {
  return {
    headersSent: false,
    statusCode: undefined,
    headers: undefined,
    body: undefined,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body) {
      this.body = body;
    },
    destroy() {
      this.destroyed = true;
    },
  };
}

async function request(prisma, method, url) {
  const response = makeResponse();
  await handleRequest({ method, url }, response, { prisma });
  return {
    status: response.statusCode,
    headers: response.headers,
    json: JSON.parse(response.body),
  };
}

test('liveness reports HTTP process health without querying the database', async () => {
  let queryCount = 0;
  const response = await request({
    $queryRaw: async () => { queryCount += 1; },
  }, 'GET', '/health/live');

  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { status: 'ok' });
  assert.equal(queryCount, 0);
});

test('readiness checks the database and reports ready', async () => {
  let queryCount = 0;
  const response = await request({
    $queryRaw: async () => { queryCount += 1; return [{ '?column?': 1 }]; },
  }, 'GET', '/health/ready');

  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { status: 'ready' });
  assert.equal(queryCount, 1);
});

test('readiness reports an unavailable database as 503', async () => {
  const response = await request({
    $queryRaw: async () => { throw new Error('database connection refused'); },
  }, 'GET', '/health/ready');

  assert.equal(response.status, 503);
  assert.deepEqual(response.json, {
    error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database is unavailable',
    },
  });
});

test('unknown routes return a JSON 404', async () => {
  const response = await request({ $queryRaw: async () => [] }, 'GET', '/not-a-route');
  assert.equal(response.status, 404);
  assert.deepEqual(response.json, {
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

test('routes reject unsupported methods and report the allowed method', async () => {
  const response = await request({ $queryRaw: async () => [] }, 'POST', '/health/live');
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'GET');
  assert.deepEqual(response.json, {
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
  });
});

test('unexpected route errors return a generic JSON 500', async () => {
  const response = await request({ $queryRaw: async () => [] }, 'GET', 'http://[');
  assert.equal(response.status, 500);
  assert.deepEqual(response.json, {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  });
});

test('app requires a Prisma-compatible readiness check', () => {
  assert.throws(() => createApp({}), /requires a Prisma client/);
});

test('HTTP server forwards requests to the route handler', async () => {
  const server = createApp({ prisma: { $queryRaw: async () => [] } });
  const response = makeResponse();
  let resolveResponse;
  const ended = new Promise((resolve) => { resolveResponse = resolve; });
  const end = response.end.bind(response);
  response.end = (body) => {
    end(body);
    resolveResponse();
  };

  server.emit('request', { method: 'GET', url: '/health/live' }, response);
  await ended;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
});
