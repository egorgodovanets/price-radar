export interface Config {
  /** HTTP port the BFF listens on. */
  port: number;
  /** Base URL of the Tracker REST API. */
  trackerUrl: string;
  /** Redis for GraphQL subscription events shared by all BFF instances. */
  redisUrl: string;
  /** Comma-separated host:port list to read price.changed from; null turns Kafka off. */
  kafkaBrokers: string | null;
}

const DEFAULT_PORT = 4000;
const DEFAULT_TRACKER_URL = 'http://localhost:4001';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;

  const port = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${raw}". Expected an integer between 1 and 65535.`);
  }
  return port;
}

function parseUrl(name: string, raw: string | undefined, fallback: string, protocols: string[]): string {
  // || (not ??): an empty string in .env also falls back to the default.
  const value = raw || fallback;
  const protocol = URL.canParse(value) ? new URL(value).protocol : '';
  if (!protocols.includes(protocol)) {
    throw new Error(`Invalid ${name}: "${value}". Expected a URL starting with ${protocols.join(' or ')}//.`);
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

/**
 * Reads BFF settings from environment variables.
 * Invalid values throw, so a misconfigured service fails at startup
 * rather than on the first request.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: parsePort(env.PORT),
    trackerUrl: parseUrl('TRACKER_URL', env.TRACKER_URL, DEFAULT_TRACKER_URL, ['http:', 'https:']),
    redisUrl: parseUrl('REDIS_URL', env.REDIS_URL, DEFAULT_REDIS_URL, ['redis:', 'rediss:']),
    kafkaBrokers: parseBrokers(env.KAFKA_BROKERS),
  };
}
