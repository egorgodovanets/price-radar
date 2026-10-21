export interface Config {
  /** Bot token from @BotFather. Secret: never log it (it is also part of every Telegram API URL). */
  telegramBotToken: string;
  /** Base URL of the Tracker REST API (watches and products). */
  trackerUrl: string;
  /** Comma-separated host:port list to read price.changed from; null turns Kafka off (bot only). */
  kafkaBrokers: string | null;
}

const DEFAULT_TRACKER_URL = 'http://localhost:4001';

// "<bot id>:<secret>", e.g. 123456789:AAH...; checks the shape only, Telegram checks the rest.
const BOT_TOKEN = /^\d+:[\w-]{20,}$/;

function parseBotToken(raw: string | undefined): string {
  const token = raw?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set. Put the token from @BotFather into .env.');
  // The value itself is not in the message: a secret must not end up in logs.
  if (!BOT_TOKEN.test(token)) throw new Error('Invalid TELEGRAM_BOT_TOKEN. Expected "<digits>:<secret>".');
  return token;
}

function parseHttpUrl(name: string, raw: string | undefined, fallback: string): string {
  // || (not ??): an empty string in .env also falls back to the default.
  const value = raw || fallback;
  const protocol = URL.canParse(value) ? new URL(value).protocol : '';
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`Invalid ${name}: "${value}". Expected a URL starting with http:// or https://.`);
  }
  return value;
}

const BROKER = /^[\w.-]+:\d{1,5}$/;

function parseBrokers(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;

  const brokers = raw.split(',').map((broker) => broker.trim());
  if (!brokers.every((broker) => BROKER.test(broker))) {
    throw new Error(`Invalid KAFKA_BROKERS: "${raw}". Expected host:port[,host:port...].`);
  }
  return brokers.join(',');
}

/** Reads Notifications settings from environment variables; throws on invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    telegramBotToken: parseBotToken(env.TELEGRAM_BOT_TOKEN),
    trackerUrl: parseHttpUrl('TRACKER_URL', env.TRACKER_URL, DEFAULT_TRACKER_URL),
    kafkaBrokers: parseBrokers(env.KAFKA_BROKERS),
  };
}
