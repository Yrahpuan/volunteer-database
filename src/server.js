const { PrismaClient } = require('@prisma/client');
const { createApp } = require('./app');

function readPort(value) {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError('PORT must be an integer between 0 and 65535.');
  }
  return port;
}

function startServer({ env = process.env, logger = console } = {}) {
  const port = readPort(env.PORT);
  const host = env.HOST || '127.0.0.1';
  const prisma = new PrismaClient();
  const server = createApp({ prisma });

  server.on('error', async (error) => {
    logger.error('HTTP server failed to start.', error);
    await prisma.$disconnect();
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
  const { shutdown } = startServer();
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { readPort, startServer };
