const { createServer } = require('node:http');
const { live, ready } = require('./modules/health/health.controller');
const { sendJson } = require('./shared/http/json-response');
const { crmVolunteer } = require('./integrations/crm/crm.controller');

function validateDependencies({ prisma }) {
  if (!prisma || typeof prisma.$queryRaw !== 'function') {
    throw new TypeError('createApp requires a Prisma client.');
  }
}

async function handleRequest(request, response, dependencies) {
  const { prisma } = dependencies;
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    if (pathname === '/api/integrations/crm/volunteers') {
      await crmVolunteer(request, response, dependencies);
      return;
    }

    if (pathname === '/health/live') {
      if (request.method !== 'GET') {
        sendJson(response, 405, {
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
        }, { allow: 'GET' });
        return;
      }
      live(request, response);
      return;
    }

    if (pathname === '/health/ready') {
      if (request.method !== 'GET') {
        sendJson(response, 405, {
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
        }, { allow: 'GET' });
        return;
      }
      await ready(request, response, { prisma });
      return;
    }

    sendJson(response, 404, {
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  } catch {
    if (!response.headersSent) {
      sendJson(response, 500, {
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
      });
    } else {
      response.destroy();
    }
  }
}

function createApp(dependencies) {
  validateDependencies(dependencies);
  return createServer((request, response) => handleRequest(request, response, dependencies));
}

module.exports = { createApp, handleRequest };
