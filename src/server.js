const { PrismaClient } = require('@prisma/client');
const { createApp } = require('./app');
const { createClient } = require('redis');
const { RedisCrmIdempotencyStore } = require('./integrations/crm/idempotency-store');
const { createCrmVolunteerService } = require('./integrations/crm/crm-volunteer.service');

function readPort(value) {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError('PORT must be an integer between 0 and 65535.');
  }
  return port;
}

async function startServer({ env = process.env, logger = console } = {}) {
  const port = readPort(env.PORT);
  const host = env.HOST || '127.0.0.1';
  const idempotencyTtlSeconds = Number(env.CRM_IDEMPOTENCY_TTL_SECONDS ?? 86400);
  if (!Number.isInteger(idempotencyTtlSeconds) || idempotencyTtlSeconds < 1) {
    throw new RangeError('CRM_IDEMPOTENCY_TTL_SECONDS must be a positive integer.');
  }
  const prisma = new PrismaClient();
  const redis = createClient({ url: env.REDIS_URL || 'redis://127.0.0.1:6379' });
  redis.on('error', (error) => logger.error('Redis client error.', error));
  try {
    await redis.connect();
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
  const idempotencyStore = new RedisCrmIdempotencyStore(redis, { ttlSeconds: idempotencyTtlSeconds });
  const crmVolunteerService = createCrmVolunteerService({ prisma, idempotencyStore });
  const server = createApp({ prisma, redis, crmVolunteerService, crmIntegrationToken: env.CRM_INTEGRATION_TOKEN });

  server.on('error', async (error) => {
    logger.error('HTTP server failed to start.', error);
    await prisma.$disconnect();
    await redis.quit();
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    const address = server.address();
    logger.info(`Volunteer backend listening at http://${host}:${address.port}`);
  });

  let shuttingDown = false;
  async function shutdown(signal = 'shutdown') {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}; closing HTTP server.`);

    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();

    server.close(async (error) => {
      try {
        await prisma.$disconnect();
        await redis.quit();
        if (error) {
          logger.error('HTTP server did not close cleanly.', error);
          process.exitCode = 1;
        }
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  return { server, prisma, shutdown };
}

if (require.main === module) {
  startServer().then(({ shutdown }) => {
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }).catch((error) => {
    console.error('Could not start the volunteer backend.', error);
    process.exitCode = 1;
  });
}

module.exports = { readPort, startServer };
