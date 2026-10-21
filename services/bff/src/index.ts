import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { startPriceChangedConsumer, type PriceChangedConsumer } from './realtime/priceChangedConsumer.js';
import { createRedisPubSub } from './realtime/redisPubSub.js';
import { createServer } from './server.js';

const config = loadConfig();
const pubsub = createRedisPubSub(config.redisUrl);
const server = await createServer({ trackerUrl: config.trackerUrl, pubsub });
// Price changes come from Tracker through Kafka; without KAFKA_BROKERS subscriptions stay quiet.
const consumer: PriceChangedConsumer | null = config.kafkaBrokers
  ? await startPriceChangedConsumer(config.kafkaBrokers, pubsub)
  : null;

await new Promise<void>((resolve, reject) => {
  server.httpServer.once('error', reject);
  server.httpServer.listen(config.port, resolve);
});
logger.info(
  { port: config.port, tracker: config.trackerUrl, kafka: config.kafkaBrokers ?? 'off' },
  `BFF ready at http://localhost:${config.port}/graphql`,
);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutting down');
  // First stop taking events from Kafka, then close client connections, then Redis.
  await consumer?.stop();
  await server.stop();
  // After the server: no subscription or mutation uses Redis anymore.
  await pubsub.close();
  logger.info('BFF stopped');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.error({ err: error }, 'Shutdown failed');
      process.exitCode = 1;
    });
  });
}
