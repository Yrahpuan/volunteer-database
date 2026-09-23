const { timingSafeEqual } = require('node:crypto');
const { sendJson } = require('../../shared/http/json-response');
const { CrmServiceError } = require('./crm-volunteer.service');

const MAX_BODY_BYTES = 1024 * 1024;

function tokenMatches(request, expected) {
  const authorization = request.headers?.authorization;
  if (!expected || typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return false;
  const actualBuffer = Buffer.from(authorization.slice(7));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) reject(new CrmServiceError(413, 'INVALID_PAYLOAD', 'Request payload is too large', { body: 'Maximum size is 1 MB' }));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new CrmServiceError(400, 'INVALID_PAYLOAD', 'Request payload is invalid', { body: 'Invalid JSON' })); }
    });
    request.on('error', reject);
  });
}

async function crmVolunteer(request, response, { crmVolunteerService, crmIntegrationToken }) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }, { allow: 'POST' });
    return;
  }
  if (!tokenMatches(request, crmIntegrationToken)) {
    sendJson(response, 401, { error: { code: 'INVALID_INTEGRATION_TOKEN', message: 'Invalid integration credentials' } });
    return;
  }
  const idempotencyKey = request.headers?.['idempotency-key'];
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200) {
    sendJson(response, 400, { error: { code: 'INVALID_PAYLOAD', message: 'Request payload is invalid', fields: { 'Idempotency-Key': 'Required (1–200 characters)' } } });
    return;
  }
  try {
    const payload = await readBody(request);
    const result = await crmVolunteerService(payload, idempotencyKey);
    sendJson(response, result.status, result.body, result.replay ? { 'idempotency-replayed': 'true' } : {});
  } catch (error) {
    if (error instanceof CrmServiceError) {
      sendJson(response, error.status, { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } });
      return;
    }
    sendJson(response, 503, { error: { code: 'CRM_INTEGRATION_UNAVAILABLE', message: 'CRM integration is temporarily unavailable' } });
  }
}

module.exports = { crmVolunteer, readBody, tokenMatches, MAX_BODY_BYTES };
