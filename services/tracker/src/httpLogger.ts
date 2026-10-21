import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';

// Accept a caller's id only if it looks like an id: it ends up in logs and in a header.
const REQUEST_ID = /^[\w-]{1,128}$/;

/**
 * Express middleware: one log line per finished request (method, url, status, time)
 * and req.log, a child logger that adds the request id to every line of this request.
 */
export const httpLogger = pinoHttp({
  logger,
  // The id from the X-Request-Id header (set by a caller or a proxy) or a new one.
  // Sent back in the response, so a user's error report can be matched to these log lines.
  genReqId(req, res) {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  // Docker's healthcheck calls /health every 5 seconds: not worth a log line each time.
  autoLogging: { ignore: (req) => req.url === '/health' },
  // Only what identifies a request. Headers stay out: they may carry tokens and cookies.
  serializers: {
    req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
  customLogLevel(_req, res, error) {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
