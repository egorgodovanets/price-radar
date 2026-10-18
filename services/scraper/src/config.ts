export interface Config {
  /** Base URL of the Tracker REST API. */
  trackerUrl: string;
  /** Pause between the end of one scrape run and the start of the next. */
  intervalMs: number;
  /** Pause between two shop pages inside one run, so the shops are not hammered. */
  requestDelayMs: number;
}

const DEFAULT_TRACKER_URL = 'http://localhost:4001';
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_REQUEST_DELAY_MS = 1000;
const MINUTE_MS = 60_000;

function parseInteger(name: string, raw: string | undefined, fallback: number, min: number, max: number): number {
  // || (not ??): an empty string in .env also falls back to the default.
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: "${raw}". Expected an integer between ${min} and ${max}.`);
  }
  return value;
}

function parseHttpUrl(name: string, raw: string | undefined, fallback: string): string {
  const value = raw || fallback;
  const protocol = URL.canParse(value) ? new URL(value).protocol : '';
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`Invalid ${name}: "${value}". Expected a URL starting with http:// or https://.`);
  }
  return value;
}

/** Reads Scraper settings from environment variables; throws on invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    trackerUrl: parseHttpUrl('TRACKER_URL', env.TRACKER_URL, DEFAULT_TRACKER_URL),
    intervalMs:
      parseInteger('SCRAPE_INTERVAL_MINUTES', env.SCRAPE_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES, 1, 24 * 60) *
      MINUTE_MS,
    requestDelayMs: parseInteger(
      'SCRAPE_REQUEST_DELAY_MS',
      env.SCRAPE_REQUEST_DELAY_MS,
      DEFAULT_REQUEST_DELAY_MS,
      0,
      MINUTE_MS,
    ),
  };
}
