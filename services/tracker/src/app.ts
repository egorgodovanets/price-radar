import express, { type ErrorRequestHandler, type Express } from 'express';
import type { ProductRepository } from './products/product.repository.js';
import { createProductRouter } from './products/product.router.js';

export interface AppDeps {
  products: ProductRepository;
}

/** express.json() fails with this error when the body is not valid JSON. */
function isMalformedJson(error: unknown): boolean {
  return error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isMalformedJson(error)) {
    res.status(400).json({ errors: ['Malformed JSON body'] });
    return;
  }
  console.error(error);
  res.status(500).json({ errors: ['Internal server error'] });
};

export function createApp({ products }: AppDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/products', createProductRouter(products));

  app.use((_req, res) => {
    res.status(404).json({ errors: ['Not found'] });
  });
  app.use(errorHandler);

  return app;
}