const { sendJson } = require('../../shared/http/json-response');

function live(_request, response) {
  sendJson(response, 200, { status: 'ok' });
}

async function ready(_request, response, { prisma }) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    sendJson(response, 200, { status: 'ready' });
  } catch {
    sendJson(response, 503, {
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
      },
    });
  }
}

module.exports = { live, ready };
