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

  it('lists the watches of one product', async () => {
    const watch = { id: 'w1', productId: 'p1', chatId: '42', targetPrice: { amount: 100, currency: 'UAH' } };
    const fetchMock = respond(200, [watch]);

    await expect(new TrackerClient('http://tracker:4001').listWatches('p1')).resolves.toEqual([watch]);
    expect((fetchMock.mock.calls[0]?.[0] as URL).href).toBe('http://tracker:4001/watches?productId=p1');
  });

  it('gets a product', async () => {
    const product = { id: 'p1', title: 'Chalk', url: 'https://troli.shop/ua/chalk_block/' };
    const fetchMock = respond(200, product);

    await expect(new TrackerClient('http://tracker:4001').getProduct('p1')).resolves.toEqual(product);
    expect((fetchMock.mock.calls[0]?.[0] as URL).href).toBe('http://tracker:4001/products/p1');
  });

  it("turns an error response into TrackerError with Tracker's message", async () => {
    respond(404, { errors: ['Product not found'] });

    const error = await new TrackerClient('http://tracker:4001').getProduct('p1').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TrackerError);
    expect(error).toMatchObject({ status: 404, message: expect.stringContaining('Product not found') });
  });
});
