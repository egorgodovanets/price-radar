import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MongoClient } from 'mongodb';
import { loadConfig } from '../config.js';
import { createServer, type TrackerServer } from '../server.js';

// Needs MongoDB from docker compose (pnpm infra:up).
const config = { ...loadConfig(), mongoDb: `price-radar-test-${randomUUID()}` };

interface WatchBody {
  id: string;
  productId: string;
  chatId: string;
  targetPrice: { amount: number; currency: string };
  createdAt: string;
}

describe('Tracker watches API', () => {
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
  const watchFor = (chatId: string) => ({
    productId,
    chatId,
    targetPrice: { amount: 1500, currency: 'UAH' },
  });

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

  let first: WatchBody;

  it('POST /watches creates a watch', async () => {
    const res = await postJson('/watches', watchFor('111'));
    first = (await res.json()) as WatchBody;

    expect(res.status).toBe(201);
    expect(first).toEqual({
      ...watchFor('111'),
      id: expect.stringMatching(/^[a-f\d]{24}$/),
      createdAt: expect.any(String),
    });
  });

  it('POST /watches rejects invalid input with 400', async () => {
    const res = await postJson('/watches', { productId, chatId: 'abc' });

    expect(res.status).toBe(400);
  });

  it('POST /watches rejects an unknown product with 422', async () => {
    const res = await postJson('/watches', {
      ...watchFor('111'),
      productId: '000000000000000000000000',
    });

    expect(res.status).toBe(422);
  });

  it('POST /watches rejects a second watch of the same chat on the same product with 409', async () => {
    const res = await postJson('/watches', {
      ...watchFor('111'),
      targetPrice: { amount: 999, currency: 'UAH' },
    });

    expect(res.status).toBe(409);
  });

  it('GET /watches?productId= lists watches of a product, newest first', async () => {
    await postJson('/watches', watchFor('222'));
    const res = await request(`/watches?productId=${productId}`);
    const list = (await res.json()) as WatchBody[];

    expect(res.status).toBe(200);
    expect(list.map((w) => w.chatId)).toEqual(['222', '111']);
  });

  it('GET /watches rejects an invalid productId filter with 400', async () => {
    const res = await request('/watches?productId=nope');

    expect(res.status).toBe(400);
  });

  it('DELETE /watches/:id removes a watch', async () => {
    const res = await request(`/watches/${first.id}`, { method: 'DELETE' });
    const after = (await (await request(`/watches?productId=${productId}`)).json()) as WatchBody[];

    expect(res.status).toBe(204);
    expect(after.map((w) => w.chatId)).toEqual(['222']);
  });

  it.each(['deleted', 'not-an-id'])('DELETE /watches/:id responds 404 for a %s id', async (kind) => {
    const id = kind === 'deleted' ? first.id : 'not-an-id';
    const res = await request(`/watches/${id}`, { method: 'DELETE' });

    expect(res.status).toBe(404);
  });
});
