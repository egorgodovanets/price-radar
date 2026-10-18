import { loadConfig } from './config.js';
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
console.log(`BFF ready at http://localhost:${config.port}/graphql`);
console.log(`Using Tracker at ${config.trackerUrl}`);
console.log(`Using Redis at ${config.redisUrl}`);
console.log(
  config.kafkaBrokers ? `Reading price changes from Kafka at ${config.kafkaBrokers}` : 'Kafka is off (KAFKA_BROKERS not set)',
);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received, shutting down...`);
  // First stop taking events from Kafka, then close client connections, then Redis.
  await consumer?.stop();
  await server.stop();
  // After the server: no subscription or mutation uses Redis anymore.
  await pubsub.close();
  console.log('BFF stopped');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      console.error('Shutdown failed', error);
      process.exitCode = 1;
    });
  });
}
