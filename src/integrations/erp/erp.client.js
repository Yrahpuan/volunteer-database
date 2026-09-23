const { ErpIntegrationError } = require('./erp-integration-error');

const DEFAULT_ACTIVITIES_PATH = '/activities';

function toQueryString({ page, pageSize, filters = {} } = {}) {
  const query = new URLSearchParams();
  if (page !== undefined) query.set('page', String(page));
  if (pageSize !== undefined) query.set('pageSize', String(pageSize));
  for (const [key, value] of Object.entries(filters)) {
    query.set(key, String(value));
  }
  return query.toString();
}

class ErpClient {
  constructor({
    baseUrl,
    activitiesPath = DEFAULT_ACTIVITIES_PATH,
    activityPath = (activityId) => `${activitiesPath}/${encodeURIComponent(activityId)}`,
    headers = {},
    fetchImpl = globalThis.fetch,
  }) {
    if (!baseUrl) throw new TypeError('ERP baseUrl is required.');
    if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');

    this.baseUrl = baseUrl;
    this.activitiesPath = activitiesPath;
    this.activityPath = activityPath;
    this.headers = headers;
    this.fetchImpl = fetchImpl;
  }

  async getActivities(params = {}) {
    const query = toQueryString(params);
    const path = query ? `${this.activitiesPath}?${query}` : this.activitiesPath;
    return this.getJson(path);
  }

  async getActivityById(activityId) {
    return this.getJson(this.activityPath(activityId));
  }

  async getJson(path) {
    let response;
    try {
      response = await this.fetchImpl(new URL(path, this.baseUrl), {
        method: 'GET',
        headers: this.headers,
      });
    } catch (cause) {
      throw ErpIntegrationError.unavailable(cause);
    }

    if (!response.ok) {
      throw ErpIntegrationError.fromStatus(response.status);
    }

    try {
      return await response.json();
    } catch (cause) {
      throw ErpIntegrationError.unavailable(cause);
    }
  }
}

module.exports = { DEFAULT_ACTIVITIES_PATH, ErpClient, toQueryString };
