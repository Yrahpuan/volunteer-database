const assert = require('node:assert/strict');
const { test } = require('node:test');
const { RedisJsonCache } = require('../src/integrations/erp/redis-json-cache');

test('Redis JSON cache serializes values and sets an expiry', async () => {
  let saved;
  const redisClient = {
    get: async () => saved?.value ?? null,
    set: async (key, value, options) => { saved = { key, value, options }; },
    del: async (key) => { saved = undefined; return key ? 1 : 0; },
  };
  const cache = new RedisJsonCache(redisClient);
  const value = { data: [{ id: 'ACT-1' }] };

  await cache.set('erp:key', value, 90);
  assert.equal(saved.key, 'erp:key');
  assert.equal(saved.value, JSON.stringify(value));
  assert.deepEqual(saved.options, { EX: 90 });
  assert.deepEqual(await cache.get('erp:key'), value);
  assert.equal(await cache.delete('erp:key'), 1);
  assert.equal(await cache.get('erp:key'), null);
});

test('Redis JSON cache rejects non-positive or fractional TTL values', async () => {
  const cache = new RedisJsonCache({ get: async () => null, set: async () => {} });
  await assert.rejects(cache.set('key', {}, 0), /positive integer/);
  await assert.rejects(cache.set('key', {}, 1.5), /positive integer/);
});
