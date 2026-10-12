export interface Config {
  /** HTTP port the BFF listens on. */
  port: number;
  /** Base URL of the Tracker REST API. */
  trackerUrl: string;
}

const DEFAULT_PORT = 4000;
const DEFAULT_TRACKER_URL = 'http://localhost:4001';

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;

  const port = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${raw}". Expected an integer between 1 and 65535.`);
  }
  return port;
}

function parseHttpUrl(name: string, raw: string | undefined, fallback: string): string {
  // || (not ??): an empty string in .env also falls back to the default.
  const value = raw || fallback;
  const protocol = URL.canParse(value) ? new URL(value).protocol : '';
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`Invalid ${name}: "${value}". Expected an http(s) URL.`);
  }
  return value;
}

/**
 * Reads BFF settings from environment variables.
 * Invalid values throw, so a misconfigured service fails at startup
 * rather than on the first request.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: parsePort(env.PORT),
    trackerUrl: parseHttpUrl('TRACKER_URL', env.TRACKER_URL, DEFAULT_TRACKER_URL),
  };
}
