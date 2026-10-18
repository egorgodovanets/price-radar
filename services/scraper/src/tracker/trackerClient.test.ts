import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { TrackerClient, TrackerError } from './trackerClient.js';

function respond(status: number, body: unknown) {
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  globalThis.fetch = fetchMock;
  return fetchMock;
}

const realFetch = globalThis.fetch;

describe('TrackerClient', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('lists products', async () => {
    const product = { id: 'p1', title: 'Chalk', url: 'https://troli.shop/ua/chalk_block/', currentPrice: null };
    const fetchMock = respond(200, [product]);

    await expect(new TrackerClient('http://tracker:4001').listProducts()).resolves.toEqual([product]);
    expect((fetchMock.mock.calls[0]?.[0] as URL).href).toBe('http://tracker:4001/products');
  });

  it('posts a price as JSON', async () => {
    const fetchMock = respond(201, { id: 'h1' });

    await new TrackerClient('http://tracker:4001').recordPrice('p1', { amount: 105, currency: 'UAH' });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect((url as URL).href).toBe('http://tracker:4001/products/p1/prices');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"amount":105,"currency":"UAH"}');
  });

  it('turns an error response into TrackerError with Tracker\'s message', async () => {
    respond(422, { errors: ['Product is priced in EUR, got UAH'] });

    const error = await new TrackerClient('http://tracker:4001')
      .recordPrice('p1', { amount: 1, currency: 'UAH' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TrackerError);
    expect(error).toMatchObject({ status: 422, message: expect.stringContaining('priced in EUR') });
  });
});
