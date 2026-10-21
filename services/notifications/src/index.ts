import { loadConfig } from './config.js';
import { startConsumeLoop } from './events/consumeLoop.js';
import { connectPriceChangedSource } from './events/kafkaConsumer.js';
import { handlePriceChangedMessage, type NotifyDeps } from './notify.js';
import { startBot } from './telegram/bot.js';
import { TelegramClient } from './telegram/telegramClient.js';
import { TrackerClient } from './tracker/trackerClient.js';

const config = loadConfig();
const telegram = new TelegramClient(config.telegramBotToken);
// Fails at startup on a wrong or revoked token, not on the first alert.
const me = await telegram.getMe();

const deps: NotifyDeps = { tracker: new TrackerClient(config.trackerUrl), telegram, log: console };

// Without KAFKA_BROKERS (local runs on Windows) only the bot runs: /start still answers the chat id.
const kafka = config.kafkaBrokers ? await connectPriceChangedSource(config.kafkaBrokers) : null;
const consumer = kafka
  ? startConsumeLoop(
      kafka,
      (message, signal) => handlePriceChangedMessage(message.value, deps, signal),
      (error) => console.error('price.changed handling failed', error),
    )
  : null;
const bot = startBot(telegram, console);

console.log(`Notifications started as @${me.username}, Tracker at ${config.trackerUrl}`);
console.log(
  config.kafkaBrokers
    ? `Reading price changes from Kafka at ${config.kafkaBrokers}`
    : 'Kafka is off (KAFKA_BROKERS not set): only the bot answers',
);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received, shutting down...`);
  // The alert in progress is finished and committed (or left for redelivery), the long poll is aborted.
  await Promise.all([consumer?.stop(), bot.stop()]);
  // Only after the loop: no consume() or commit may run on a disconnected consumer.
  await kafka?.close();
  console.log('Notifications stopped');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      console.error('Shutdown failed', error);
      process.exitCode = 1;
    });
  });
}
