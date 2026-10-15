import { loadConfig } from './config.js';
import { createRedisPubSub } from './realtime/redisPubSub.js';
import { createServer } from './server.js';

const config = loadConfig();
const pubsub = createRedisPubSub(config.redisUrl);
const server = await createServer({ trackerUrl: config.trackerUrl, pubsub });

await new Promise<void>((resolve, reject) => {
  server.httpServer.once('error', reject);
  server.httpServer.listen(config.port, resolve);
});
console.log(`BFF ready at http://localhost:${config.port}/graphql`);
console.log(`Using Tracker at ${config.trackerUrl}`);
console.log(`Using Redis at ${config.redisUrl}`);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received, shutting down...`);
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
