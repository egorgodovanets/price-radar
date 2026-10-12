import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import { createServer, type BffServer } from './server.js';
import type {
  CreateProductBody,
  CreateWatchBody,
  PricePointDto,
  ProductDto,
  WatchDto,
} from './dataSources/tracker.types.js';

interface GraphQLResponse {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

const PRODUCT_ID = '665f1c2a9b1e8a3d4c5b6a71';
const NEW_PRODUCT_ID = '665f1c2a9b1e8a3d4c5b6a72';

const product: ProductDto = {
  id: PRODUCT_ID,
  title: 'Yoga mat',
  url: 'https://troli.shop/ua/yoga-mat',
  category: 'sport',
  attributes: { color: 'blue', thicknessMm: 6 },
  currentPrice: { amount: 1500, currency: 'UAH' },
  priceUpdatedAt: '2026-10-01T10:00:00.000Z',
  createdAt: '2026-09-30T10:00:00.000Z',
};

const pricePoint: PricePointDto = {
  id: '665f1c2a9b1e8a3d4c5b6a81',
  productId: PRODUCT_ID,
  price: { amount: 1500, currency: 'UAH' },
  observedAt: '2026-10-01T10:00:00.000Z',
};

const watch = (id: string): WatchDto => ({
  id,
  productId: PRODUCT_ID,
  chatId: '123',
  targetPrice: { amount: 1200, currency: 'UAH' },
  createdAt: '2026-10-01T11:00:00.000Z',
});

/** Minimal stand-in for Tracker: canned answers plus a log of what the BFF asked for. */
function createFakeTracker(requests: string[]): http.Server {
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

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

async function close(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function graphQLClient(baseUrl: () => string) {
  return async (query: string, variables?: Record<string, unknown>) => {
    const res = await fetch(`${baseUrl()}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return { status: res.status, body: (await res.json()) as GraphQLResponse };
  };
}

describe('BFF server', () => {
  const trackerRequests: string[] = [];
  const tracker = createFakeTracker(trackerRequests);
  let server: BffServer | undefined;
  let baseUrl = '';
  const graphql = graphQLClient(() => baseUrl);

  beforeAll(async () => {
    const trackerUrl = await listen(tracker);
    const created = await createServer({ trackerUrl });
    server = created;
    baseUrl = await listen(created.httpServer);
  });

  afterAll(async () => {
    await server?.stop();
    await close(tracker);
  });

  beforeEach(() => {
    trackerRequests.length = 0;
  });

  it('responds to GET /health', async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('lists products and turns attributes into name/value pairs', async () => {
    const { body } = await graphql(`{
      products { id title category attributes { name value } currentPrice { amount currency } }
    }`);

    expect(body).toEqual({
      data: {
        products: [
          {
            id: PRODUCT_ID,
            title: 'Yoga mat',
            category: 'sport',
            attributes: [
              { name: 'color', value: 'blue' },
              { name: 'thicknessMm', value: '6' },
            ],
            currentPrice: { amount: 1500, currency: 'UAH' },
          },
        ],
      },
    });
  });

  it('returns null for a product Tracker does not know', async () => {
    const { body } = await graphql('query ($id: ID!) { product(id: $id) { id } }', { id: NEW_PRODUCT_ID });

    expect(body).toEqual({ data: { product: null } });
  });

  it('calls Tracker only for the fields the query asks for', async () => {
    await graphql('query ($id: ID!) { product(id: $id) { title } }', { id: PRODUCT_ID });
    expect(trackerRequests).toEqual([`GET /products/${PRODUCT_ID}`]);

    trackerRequests.length = 0;
    const { body } = await graphql(
      `query ($id: ID!) {
        product(id: $id) { priceHistory(limit: 5) { price { amount } observedAt } watches { id } }
      }`,
      { id: PRODUCT_ID },
    );

    expect(body.errors).toBeUndefined();
    expect(trackerRequests).toEqual(
      expect.arrayContaining([
        `GET /products/${PRODUCT_ID}/prices?limit=5`,
        `GET /watches?productId=${PRODUCT_ID}`,
      ]),
    );
  });

  it('adds a product, sending attributes to Tracker as an object', async () => {
    const { body } = await graphql(
      `mutation ($input: AddProductInput!) {
        addProduct(input: $input) { id url currentPrice { amount } attributes { name value } }
      }`,
      {
        input: {
          title: 'Phone case',
          url: 'https://www.icover.lt/case',
          category: 'electronics',
          attributes: [{ name: 'model', value: 'iPhone 15' }],
        },
      },
    );

    expect(body).toEqual({
      data: {
        addProduct: {
          id: NEW_PRODUCT_ID,
          url: 'https://www.icover.lt/case',
          currentPrice: null,
          attributes: [{ name: 'model', value: 'iPhone 15' }],
        },
      },
    });
  });

  it('maps Tracker 409 to a CONFLICT error with the Tracker message', async () => {
    const { body } = await graphql(
      'mutation ($input: AddProductInput!) { addProduct(input: $input) { id } }',
      { input: { title: 'Yoga mat', url: product.url, category: 'sport' } },
    );

    expect(body.data).toBeNull();
    expect(body.errors?.[0]?.message).toBe(`Product with url "${product.url}" already exists`);
    expect(body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('records a price', async () => {
    const { body } = await graphql(
      'mutation ($id: ID!) { recordPrice(productId: $id, price: { amount: 1399, currency: UAH }) { price { amount currency } } }',
      { id: PRODUCT_ID },
    );

    expect(body).toEqual({ data: { recordPrice: { price: { amount: 1399, currency: 'UAH' } } } });
  });

  it('maps Tracker 422 on createWatch to BAD_USER_INPUT', async () => {
    const { body } = await graphql(
      'mutation ($input: CreateWatchInput!) { createWatch(input: $input) { id } }',
      { input: { productId: NEW_PRODUCT_ID, chatId: '123', targetPrice: { amount: 1000, currency: 'UAH' } } },
    );

    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('deletes a watch and reports false for an unknown one', async () => {
    // Aliases let one operation call the same field twice.
    const { body } = await graphql('mutation { known: deleteWatch(id: "w1") unknown: deleteWatch(id: "w9") }');

    expect(body).toEqual({ data: { known: true, unknown: false } });
  });

  it('loads the product of several watches with one Tracker request', async () => {
    const { body } = await graphql('{ watches { id product { title } } }');

    expect(body).toEqual({
      data: {
        watches: [
          { id: 'w1', product: { title: 'Yoga mat' } },
          { id: 'w2', product: { title: 'Yoga mat' } },
        ],
      },
    });
    expect(trackerRequests).toEqual(['GET /watches', `GET /products/${PRODUCT_ID}`]);
  });

  it('hides Tracker 5xx details behind BAD_GATEWAY', async () => {
    const { body } = await graphql('{ product(id: "broken") { id } }');

    expect(body.errors?.[0]?.message).toBe('Tracker request failed');
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_GATEWAY');
  });

  it('rejects unknown fields with a validation error', async () => {
    const { status, body } = await graphql('{ unknownField }');

    expect(status).toBe(400);
    expect(body.errors?.[0]?.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
  });

  it('closes the HTTP server on stop()', async () => {
    await server?.stop();
    const httpServer = server?.httpServer;
    server = undefined;

    expect(httpServer?.listening).toBe(false);
  });
});

describe('BFF server when Tracker is down', () => {
  let server: BffServer | undefined;
  let baseUrl = '';
  const graphql = graphQLClient(() => baseUrl);

  beforeAll(async () => {
    // Take a free port and release it, so nothing listens there.
    const placeholder = http.createServer();
    const trackerUrl = await listen(placeholder);
    await close(placeholder);

    server = await createServer({ trackerUrl });
    baseUrl = await listen(server.httpServer);
  });

  afterAll(async () => {
    await server?.stop();
  });

  it('answers with BAD_GATEWAY instead of a raw network error', async () => {
    const { body } = await graphql('{ products { id } }');

    expect(body.errors?.[0]?.message).toBe('Tracker is unavailable');
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_GATEWAY');
  });
});
