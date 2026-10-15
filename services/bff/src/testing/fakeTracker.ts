/**
 * Test helpers shared by the BFF test suites: a fake Tracker and a tiny GraphQL HTTP client.
 * Not part of the build (see tsconfig.build.json).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type {
  CreateProductBody,
  CreateWatchBody,
  PricePointDto,
  ProductDto,
  WatchDto,
} from '../dataSources/tracker.types.js';

export interface GraphQLResponse {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

export const PRODUCT_ID = '665f1c2a9b1e8a3d4c5b6a71';
export const NEW_PRODUCT_ID = '665f1c2a9b1e8a3d4c5b6a72';

export const product: ProductDto = {
  id: PRODUCT_ID,
  title: 'Yoga mat',
  url: 'https://troli.shop/ua/yoga-mat',
  category: 'sport',
  attributes: { color: 'blue', thicknessMm: 6 },
  currentPrice: { amount: 1500, currency: 'UAH' },
  priceUpdatedAt: '2026-10-01T10:00:00.000Z',
  createdAt: '2026-09-30T10:00:00.000Z',
};

export const pricePoint: PricePointDto = {
  id: '665f1c2a9b1e8a3d4c5b6a81',
  productId: PRODUCT_ID,
  price: { amount: 1500, currency: 'UAH' },
  observedAt: '2026-10-01T10:00:00.000Z',
};

export const watch = (id: string): WatchDto => ({
  id,
  productId: PRODUCT_ID,
  chatId: '123',
  targetPrice: { amount: 1200, currency: 'UAH' },
  createdAt: '2026-10-01T11:00:00.000Z',
});

/** Minimal stand-in for Tracker: canned answers plus a log of what the BFF asked for. */
export function createFakeTracker(requests: string[]): http.Server {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    requests.push(`${req.method} ${req.originalUrl}`);
    next();
  });

  app.get('/products', (_req, res) => {
    res.json([product]);
  });
  app.get('/products/:id', (req, res) => {
    if (req.params.id === 'broken') {
      res.status(500).json({ errors: ['Internal server error'] });
      return;
    }
    if (req.params.id !== PRODUCT_ID) {
      res.status(404).json({ errors: ['Product not found'] });
      return;
    }
    res.json(product);
  });
  app.post('/products', (req, res) => {
    const body = req.body as CreateProductBody;
    if (body.url === product.url) {
      res.status(409).json({ errors: [`Product with url "${body.url}" already exists`] });
      return;
    }
    res.status(201).json({ ...product, ...body, id: NEW_PRODUCT_ID, currentPrice: null, priceUpdatedAt: null });
  });
  app.get('/products/:id/prices', (_req, res) => {
    res.json([pricePoint]);
  });
  app.post('/products/:id/prices', (req, res) => {
    res.status(201).json({ ...pricePoint, price: req.body as unknown });
  });
  app.get('/watches', (_req, res) => {
    res.json([watch('w1'), watch('w2')]);
  });
  app.post('/watches', (req, res) => {
    const body = req.body as CreateWatchBody;
    if (body.productId !== PRODUCT_ID) {
      res.status(422).json({ errors: [`Product "${body.productId}" not found`] });
      return;
    }
    res.status(201).json({ ...watch('w3'), ...body });
  });
  app.delete('/watches/:id', (req, res) => {
    if (req.params.id !== 'w1') {
      res.status(404).json({ errors: ['Watch not found'] });
      return;
    }
    res.status(204).end();
  });

  return http.createServer(app);
}

export async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

export async function close(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export function graphQLClient(baseUrl: () => string) {
  return async (query: string, variables?: Record<string, unknown>) => {
    const res = await fetch(`${baseUrl()}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return { status: res.status, body: (await res.json()) as GraphQLResponse };
  };
}
