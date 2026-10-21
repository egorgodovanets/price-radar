import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = await createServer(config);

await new Promise<void>((resolve, reject) => {
  server.httpServer.once('error', reject);
  server.httpServer.listen(config.port, resolve);
});
// Fields, not a sentence: a log search can filter by port or kafka. The Mongo URL is left out (it may hold a password).
logger.info({ port: config.port, kafka: config.kafkaBrokers ?? 'off' }, 'Tracker ready');

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutting down');
  await server.stop();
  logger.info('Tracker stopped');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.error({ err: error }, 'Shutdown failed');
      process.exitCode = 1;
    });
  });
}
