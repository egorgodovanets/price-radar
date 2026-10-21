import { loadConfig } from './config.js';
import { startConsumeLoop } from './events/consumeLoop.js';
import { connectPriceChangedSource } from './events/kafkaConsumer.js';
import { logger } from './logger.js';
import { handlePriceChangedMessage, type NotifyDeps } from './notify.js';
import { startBot } from './telegram/bot.js';
import { TelegramClient } from './telegram/telegramClient.js';
import { TrackerClient } from './tracker/trackerClient.js';

const config = loadConfig();
const telegram = new TelegramClient(config.telegramBotToken);
// Fails at startup on a wrong or revoked token, not on the first alert.
const me = await telegram.getMe();

const deps: NotifyDeps = { tracker: new TrackerClient(config.trackerUrl), telegram, log: logger };

// Without KAFKA_BROKERS (local runs on Windows) only the bot runs: /start still answers the chat id.
const kafka = config.kafkaBrokers ? await connectPriceChangedSource(config.kafkaBrokers) : null;
const consumer = kafka
  ? startConsumeLoop(
      kafka,
      (message, signal) => handlePriceChangedMessage(message.value, deps, signal),
      (error) => logger.error({ err: error }, 'price.changed handling failed'),
    )
  : null;
const bot = startBot(telegram, logger);

// Kafka "off" means only the bot answers (/start); no price alerts.
logger.info(
  { bot: me.username, tracker: config.trackerUrl, kafka: config.kafkaBrokers ?? 'off' },
  'Notifications started',
);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutting down');
  // The alert in progress is finished and committed (or left for redelivery), the long poll is aborted.
  await Promise.all([consumer?.stop(), bot.stop()]);
  // Only after the loop: no consume() or commit may run on a disconnected consumer.
  await kafka?.close();
  logger.info('Notifications stopped');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.error({ err: error }, 'Shutdown failed');
      process.exitCode = 1;
    });
  });
}
