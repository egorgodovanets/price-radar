import express, { type ErrorRequestHandler, type Express } from 'express';
import { httpLogger } from './httpLogger.js';
import { createPriceRouter } from './prices/price.router.js';
import type { PriceService } from './prices/price.service.js';
import type { ProductRepository } from './products/product.repository.js';
import { createProductRouter } from './products/product.router.js';
import { createWatchRouter } from './watches/watch.router.js';
import type { WatchService } from './watches/watch.service.js';

export interface AppDeps {
  products: ProductRepository;
  watches: WatchService;
  prices: PriceService;
}

/** express.json() fails with this error when the body is not valid JSON. */
function isMalformedJson(error: unknown): boolean {
  return error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';
}

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (isMalformedJson(error)) {
    res.status(400).json({ errors: ['Malformed JSON body'] });
    return;
  }
  // req.log carries the request id: this line can be matched to the request's other lines.
  req.log.error({ err: error }, 'Unhandled error');
  res.status(500).json({ errors: ['Internal server error'] });
};

export function createApp({ products, watches, prices }: AppDeps): Express {
  const app = express();
  // First, so every request is logged, including those that fail JSON parsing.
  app.use(httpLogger);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/products/:id/prices', createPriceRouter(prices));
  app.use('/products', createProductRouter(products));
  app.use('/watches', createWatchRouter(watches));

  app.use((_req, res) => {
    res.status(404).json({ errors: ['Not found'] });
  });
  app.use(errorHandler);

  return app;
}
