class RedisJsonCache {
  constructor(redisClient) {
    if (!redisClient || typeof redisClient.get !== 'function' || typeof redisClient.set !== 'function') {
      throw new TypeError('RedisJsonCache requires a Redis-compatible client.');
    }
    this.redisClient = redisClient;
  }

  async get(key) {
    const value = await this.redisClient.get(key);
    return value === null ? null : JSON.parse(value);
  }

  async set(key, value, ttlSeconds) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError('Cache TTL must be a positive integer number of seconds.');
    }
    await this.redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }

  async delete(key) {
    return this.redisClient.del(key);
  }
}

module.exports = { RedisJsonCache };
