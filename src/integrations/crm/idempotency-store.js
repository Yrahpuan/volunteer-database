const { createHash } = require('node:crypto');

class RedisCrmIdempotencyStore {
  constructor(redis, { ttlSeconds = 86400, prefix = 'crm:idempotency:' } = {}) {
    if (!redis || typeof redis.set !== 'function' || typeof redis.get !== 'function') {
      throw new TypeError('RedisCrmIdempotencyStore requires a Redis-compatible client.');
    }
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1) {
      throw new RangeError('CRM idempotency TTL must be a positive integer.');
    }
    this.redis = redis;
    this.ttlSeconds = ttlSeconds;
    this.prefix = prefix;
  }

  keyFor(key) {
    return `${this.prefix}${createHash('sha256').update(key).digest('hex')}`;
  }

  async claim(key, fingerprint) {
    const redisKey = this.keyFor(key);
    const claimed = await this.redis.set(redisKey, JSON.stringify({ fingerprint, state: 'processing' }), {
      NX: true,
      EX: this.ttlSeconds,
    });
    if (claimed === 'OK') return { status: 'claimed' };
    const value = await this.redis.get(redisKey);
    if (value === null) return this.claim(key, fingerprint);
    const record = JSON.parse(value);
    if (record.fingerprint !== fingerprint) return { status: 'conflict' };
    if (record.state === 'complete') return { status: 'replay', response: record.response };
    return { status: 'processing' };
  }

  async complete(key, fingerprint, response) {
    const redisKey = this.keyFor(key);
    const value = await this.redis.get(redisKey);
    if (value === null) return false;
    const record = JSON.parse(value);
    if (record.fingerprint !== fingerprint || record.state !== 'processing') return false;
    await this.redis.set(redisKey, JSON.stringify({ fingerprint, state: 'complete', response }), {
      XX: true,
      EX: this.ttlSeconds,
    });
    return true;
  }

  async release(key, fingerprint) {
    const redisKey = this.keyFor(key);
    const value = await this.redis.get(redisKey);
    if (value === null) return;
    const record = JSON.parse(value);
    if (record.fingerprint === fingerprint && record.state === 'processing') {
      await this.redis.del(redisKey);
    }
  }
}

module.exports = { RedisCrmIdempotencyStore };
