const { createHash } = require('node:crypto');

const DEFAULT_CACHE_TTL_SECONDS = 300;

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function filtersHash(filters = {}) {
  return createHash('sha256').update(stableStringify(filters)).digest('hex').slice(0, 12);
}

function activitiesCacheKey({ page = 1, pageSize = 50, filters = {} } = {}) {
  return `erp:activities:${page}:${pageSize}:${filtersHash(filters)}`;
}

function activityCacheKey(activityId) {
  return `erp:activity:${activityId}`;
}

function readCacheTtl(value = process.env.ERP_ACTIVITIES_CACHE_TTL_SECONDS) {
  if (value === undefined || value === '') return DEFAULT_CACHE_TTL_SECONDS;
  const ttl = Number(value);
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new RangeError('ERP_ACTIVITIES_CACHE_TTL_SECONDS must be a positive integer.');
  }
  return ttl;
}

class ErpActivityService {
  constructor({ erpClient, cache, cacheTtlSeconds = DEFAULT_CACHE_TTL_SECONDS }) {
    if (!erpClient || typeof erpClient.getActivities !== 'function' || typeof erpClient.getActivityById !== 'function') {
      throw new TypeError('ErpActivityService requires an ERP client.');
    }
    if (!cache || typeof cache.get !== 'function' || typeof cache.set !== 'function') {
      throw new TypeError('ErpActivityService requires a cache adapter.');
    }
    if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds <= 0) {
      throw new RangeError('cacheTtlSeconds must be a positive integer.');
    }

    this.erpClient = erpClient;
    this.cache = cache;
    this.cacheTtlSeconds = cacheTtlSeconds;
  }

  async getActivities(params = {}) {
    const normalizedParams = {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
      filters: params.filters ?? {},
    };
    const key = activitiesCacheKey(normalizedParams);
    const cached = await this.cache.get(key);
    if (cached !== null && cached !== undefined) return cached;

    const activities = await this.erpClient.getActivities(normalizedParams);
    await this.cache.set(key, activities, this.cacheTtlSeconds);
    return activities;
  }

  async getActivityById(activityId) {
    const key = activityCacheKey(activityId);
    const cached = await this.cache.get(key);
    if (cached !== null && cached !== undefined) return cached;

    const activity = await this.erpClient.getActivityById(activityId);
    await this.cache.set(key, activity, this.cacheTtlSeconds);
    return activity;
  }

  async validateScheduleIds(activityId, scheduleIds) {
    if (!Array.isArray(scheduleIds)) return false;
    const activity = await this.getActivityById(activityId);
    const availableScheduleIds = new Set(activity.schedules.map(({ id }) => id));
    return scheduleIds.every((id) => availableScheduleIds.has(id));
  }
}

module.exports = {
  DEFAULT_CACHE_TTL_SECONDS,
  ErpActivityService,
  activitiesCacheKey,
  activityCacheKey,
  filtersHash,
  readCacheTtl,
};
