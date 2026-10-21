import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger };

/**
 * Structured logs: one JSON object per line on stdout (level, time, name, message, fields).
 * Docker and log collectors take stdout as is and can search by any field.
 * In development nodemon sets LOG_PRETTY=true and pino-pretty prints readable text instead.
 */
export function createLogger(name: string, env: NodeJS.ProcessEnv = process.env): Logger {
  const options: LoggerOptions = {
    name,
    // Jest sets NODE_ENV=test: tests stay quiet unless LOG_LEVEL asks otherwise.
    level: env.LOG_LEVEL || (env.NODE_ENV === 'test' ? 'silent' : 'info'),
  };
  // pino-pretty is a dev dependency only; the Docker image never sets LOG_PRETTY.
  if (env.LOG_PRETTY === 'true') options.transport = { target: 'pino-pretty' };
  return pino(options);
}

/** The logger of this service. Errors go under the "err" key, so pino prints type, message and stack. */
export const logger = createLogger('tracker');
