const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('redis');
const { test } = require('node:test');
const { RedisJsonCache } = require('../src/integrations/erp/redis-json-cache');

const redisUrl = process.env.REDIS_URL;

test('Redis cache stores JSON, expires keys, and supports deletion', {
  skip: redisUrl ? false : 'Set REDIS_URL and start Redis to run cache integration tests.',
}, async () => {
  const redis = createClient({ url: redisUrl });
  redis.on('error', () => {});
  await redis.connect();

  const cache = new RedisJsonCache(redis);
  const key = `test:erp:${randomUUID()}`;
  try {
    assert.equal(await cache.get(key), null);
    await cache.set(key, { activityId: 'ACT-1' }, 5);
    assert.deepEqual(await cache.get(key), { activityId: 'ACT-1' });

    await cache.delete(key);
    assert.equal(await cache.get(key), null);

    await cache.set(key, { activityId: 'ACT-2' }, 1);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal(await cache.get(key), null);
  } finally {
    await cache.delete(key);
    await redis.quit();
  }
});
