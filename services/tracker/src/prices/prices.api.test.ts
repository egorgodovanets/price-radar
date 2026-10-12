import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MongoClient } from 'mongodb';
import { loadConfig } from '../config.js';
import { createServer, type TrackerServer } from '../server.js';

// Needs MongoDB from docker compose (pnpm infra:up).
const config = { ...loadConfig(), mongoDb: `price-radar-test-${randomUUID()}` };

interface MoneyBody {
  amount: number;
  currency: string;
}

interface PricePointBody {
  id: string;
  productId: string;
  price: MoneyBody;
  observedAt: string;
}

interface ProductBody {
  currentPrice: MoneyBody | null;
  priceUpdatedAt: string | null;
}

describe('Tracker price history API', () => {
  let server: TrackerServer;
  let baseUrl = '';
  let productId = '';

  const request = (path: string, init?: RequestInit) => fetch(`${baseUrl}${path}`, init);
  const postJson = (path: string, body: unknown) =>
    request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const pricesOf = (id: string) => `/products/${id}/prices`;
  const amountsOf = async (res: Response) =>
    ((await res.json()) as PricePointBody[]).map((p) => p.price.amount);

  beforeAll(async () => {
    server = await createServer(config);
    await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = server.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    const res = await postJson('/products', {
      title: 'Yoga mat',
      url: 'https://troli.shop/ua/yoga-mat',
      category: 'sport',
    });
    productId = ((await res.json()) as { id: string }).id;
  });

  afterAll(async () => {
    await server.stop();
    const client = await MongoClient.connect(config.mongoUrl);
    await client.db(config.mongoDb).dropDatabase();
    await client.close();
  });

  it('GET /products/:id/prices is empty before the first price', async () => {
    const res = await request(pricesOf(productId));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /products/:id/prices records a price point', async () => {
    const res = await postJson(pricesOf(productId), { amount: 1700, currency: 'UAH' });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.stringMatching(/^[a-f\d]{24}$/),
      productId,
      price: { amount: 1700, currency: 'UAH' },
      observedAt: expect.any(String),
    });
  });

  it('the product shows the latest price as currentPrice', async () => {
    await postJson(pricesOf(productId), { amount: 1500, currency: 'UAH' });
    const product = (await (await request(`/products/${productId}`)).json()) as ProductBody;

    expect(product.currentPrice).toEqual({ amount: 1500, currency: 'UAH' });
    expect(product.priceUpdatedAt).toEqual(expect.any(String));
  });

  it('GET /products/:id/prices lists the history, newest first', async () => {
    const res = await request(pricesOf(productId));

    expect(res.status).toBe(200);
    expect(await amountsOf(res)).toEqual([1500, 1700]);
  });

  it('GET /products/:id/prices?limit=1 returns only the newest point', async () => {
    expect(await amountsOf(await request(`${pricesOf(productId)}?limit=1`))).toEqual([1500]);
  });

  it('GET /products/:id/prices rejects an invalid limit with 400', async () => {
    const res = await request(`${pricesOf(productId)}?limit=0`);

    expect(res.status).toBe(400);
  });

  it('POST /products/:id/prices rejects an invalid price with 400', async () => {
    const res = await postJson(pricesOf(productId), { amount: -5, currency: 'UAH' });

    expect(res.status).toBe(400);
  });

  it('POST /products/:id/prices rejects another currency with 422', async () => {
    const res = await postJson(pricesOf(productId), { amount: 50, currency: 'EUR' });

    expect(res.status).toBe(422);
  });

  it.each(['000000000000000000000000', 'not-an-id'])(
    'POST and GET respond 404 for product %s',
    async (id) => {
      const post = await postJson(pricesOf(id), { amount: 100, currency: 'UAH' });
      const get = await request(pricesOf(id));

      expect(post.status).toBe(404);
      expect(get.status).toBe(404);
    },
  );
});
