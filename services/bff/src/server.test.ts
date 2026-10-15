import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { PubSub } from 'graphql-subscriptions';
import { createServer, type BffServer } from './server.js';
import {
  close,
  createFakeTracker,
  graphQLClient,
  listen,
  NEW_PRODUCT_ID,
  PRODUCT_ID,
  product,
} from './testing/fakeTracker.js';

describe('BFF server', () => {
  const trackerRequests: string[] = [];
  const tracker = createFakeTracker(trackerRequests);
  let server: BffServer | undefined;
  let baseUrl = '';
  const graphql = graphQLClient(() => baseUrl);

  beforeAll(async () => {
    const trackerUrl = await listen(tracker);
    const created = await createServer({ trackerUrl, pubsub: new PubSub() });
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

    server = await createServer({ trackerUrl, pubsub: new PubSub() });
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
