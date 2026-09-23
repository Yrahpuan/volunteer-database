const { ErpClient } = require('./erp.client');
const { ErpActivityService, readCacheTtl } = require('./erp-activity.service');
const { RedisJsonCache } = require('./redis-json-cache');

function createErpActivityService({ env = process.env, redisClient, fetchImpl, headers = {} } = {}) {
  const baseUrl = env.ERP_BASE_URL;
  if (!baseUrl) throw new TypeError('ERP_BASE_URL is required.');

  const activitiesPath = env.ERP_ACTIVITIES_PATH || '/activities';
  const activityPathTemplate = env.ERP_ACTIVITY_BY_ID_PATH || `${activitiesPath}/:id`;
  const erpClient = new ErpClient({
    baseUrl,
    activitiesPath,
    activityPath: (id) => activityPathTemplate.replace(':id', encodeURIComponent(id)),
    headers,
    fetchImpl,
  });
  const cache = new RedisJsonCache(redisClient);

  return new ErpActivityService({
    erpClient,
    cache,
    cacheTtlSeconds: readCacheTtl(env.ERP_ACTIVITIES_CACHE_TTL_SECONDS),
  });
}

module.exports = { createErpActivityService };
