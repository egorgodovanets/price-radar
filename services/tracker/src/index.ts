import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = await createServer(config);

await new Promise<void>((resolve, reject) => {
  server.httpServer.once('error', reject);
  server.httpServer.listen(config.port, resolve);
});
console.log(`Tracker ready at http://localhost:${config.port}`);
console.log(
  config.kafkaBrokers ? `Publishing price changes to Kafka at ${config.kafkaBrokers}` : 'Kafka is off (KAFKA_BROKERS not set)',
);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received, shutting down...`);
  await server.stop();
  console.log('Tracker stopped');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      console.error('Shutdown failed', error);
      process.exitCode = 1;
    });
  });
}
