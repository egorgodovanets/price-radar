import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MongoClient } from 'mongodb';
import { loadConfig } from '../config.js';
import { createServer, type TrackerServer } from '../server.js';

// Needs MongoDB from docker compose (pnpm infra:up).
// Each run uses a throwaway database that is dropped afterwards.
const config = { ...loadConfig(), mongoDb: `price-radar-test-${randomUUID()}` };

interface ProductBody {
  id: string;
  title: string;
  url: string;
  category: string;
  attributes: Record<string, unknown>;
  createdAt: string;
}

interface ErrorBody {
  errors: string[];
}

describe('Tracker products API', () => {
  let server: TrackerServer;
  let baseUrl = '';

  const request = (path: string, init?: RequestInit) => fetch(`${baseUrl}${path}`, init);
  const postJson = (path: string, body: unknown) =>
    request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    server = await createServer(config);
    await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = server.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await server.stop();
    const client = await MongoClient.connect(config.mongoUrl);
    await client.db(config.mongoDb).dropDatabase();
    await client.close();
  });

  const mat = {
    title: 'Yoga mat',
    url: 'https://troli.shop/ua/yoga-mat',
    category: 'sport',
    attributes: { color: 'blue' },
  };
  const phone = {
    title: 'iPhone 16',
    url: 'https://www.icover.lt/iphone-16',
    category: 'electronics',
    attributes: { storageGb: 128 },
  };
  let created: ProductBody;

  it('GET /health responds ok', async () => {
    const res = await request('/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('POST /products creates a product', async () => {
    const res = await postJson('/products', mat);
    created = (await res.json()) as ProductBody;

    expect(res.status).toBe(201);
    expect(created).toEqual({
      ...mat,
      id: expect.stringMatching(/^[a-f\d]{24}$/),
      createdAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
  });

  it('POST /products rejects invalid input with 400', async () => {
    const res = await postJson('/products', { title: '' });
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(400);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('POST /products rejects a duplicate url with 409', async () => {
    const res = await postJson('/products', { ...mat, title: 'Another title' });

    expect(res.status).toBe(409);
  });

  it('POST /products rejects malformed JSON with 400', async () => {
    const res = await request('/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });

    expect(res.status).toBe(400);
  });

  it('GET /products lists products, newest first', async () => {
    await postJson('/products', phone);
    const res = await request('/products');
    const list = (await res.json()) as ProductBody[];

    expect(res.status).toBe(200);
    expect(list.map((p) => p.url)).toEqual([phone.url, mat.url]);
  });

  it('GET /products/:id returns one product', async () => {
    const res = await request(`/products/${created.id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(created);
  });

  it.each(['000000000000000000000000', 'not-an-id'])(
    'GET /products/%s responds 404',
    async (id) => {
      const res = await request(`/products/${id}`);

      expect(res.status).toBe(404);
    },
  );

  it('unknown routes respond 404', async () => {
    const res = await request('/nope');

    expect(res.status).toBe(404);
  });
});
