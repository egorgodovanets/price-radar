export interface Config {
  /** HTTP port the BFF listens on. */
  port: number;
}

const DEFAULT_PORT = 4000;

/**
 * Reads BFF settings from environment variables.
 * Invalid values throw, so a misconfigured service fails at startup
 * rather than on the first request.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const raw = env.PORT;
  if (raw === undefined) {
    return { port: DEFAULT_PORT };
  }

  const port = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${raw}". Expected an integer between 1 and 65535.`);
  }

  return { port };
}