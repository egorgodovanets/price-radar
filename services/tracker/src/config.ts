export interface Config {
  port: number;
  mongoUrl: string;
  mongoDb: string;
}

const DEFAULT_PORT = 4001;
const DEFAULT_MONGO_URL = 'mongodb://localhost:27017';
const DEFAULT_MONGO_DB = 'price-radar';

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;

  const port = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${raw}". Expected an integer between 1 and 65535.`);
  }
  return port;
}

/** Reads Tracker settings from environment variables; throws on invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: parsePort(env.PORT),
    // || (not ??) on purpose: an empty string in .env also falls back to the default.
    mongoUrl: env.MONGO_URL || DEFAULT_MONGO_URL,
    mongoDb: env.MONGO_DB || DEFAULT_MONGO_DB,
  };
}