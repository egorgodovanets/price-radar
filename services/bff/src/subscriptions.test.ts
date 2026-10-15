import { EventEmitter } from 'node:events';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { PubSub } from 'graphql-subscriptions';
import { createClient, type Client } from 'graphql-ws';
import WebSocket from 'ws';
import { PRICE_CHANGED } from './realtime/events.js';
import { createServer, type BffServer } from './server.js';
import {
  close,
  createFakeTracker,
  graphQLClient,
  listen,
  NEW_PRODUCT_ID,
  pricePoint,
  PRODUCT_ID,
} from './testing/fakeTracker.js';

const PRICE_CHANGED_SUBSCRIPTION = `
  subscription ($productId: ID) {
    priceChanged(productId: $productId) {
      productId
      price { amount currency }
      previousPrice { amount currency }
      observedAt
    }
  }
`;

const RECORD_PRICE = 'mutation ($id: ID!, $amount: Float!) { recordPrice(productId: $id, price: { amount: $amount, currency: UAH }) { id } }';

/** Starts a subscription and collects everything it receives. */
function subscribe(client: Client, variables: Record<string, unknown>) {
  const events: unknown[] = [];
  const errors: unknown[] = [];
  const unsubscribe = client.subscribe(
    { query: PRICE_CHANGED_SUBSCRIPTION, variables },
    { next: (result) => events.push(result), error: (error) => errors.push(error), complete: () => undefined },
  );
  return { events, errors, unsubscribe };
}

async function waitUntil(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('Timed out waiting for a condition');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('priceChanged subscription', () => {
  const tracker = createFakeTracker([]);
  // In-memory pub/sub instead of Redis. Its emitter shows how many subscriptions
  // are listening, so tests know when a subscription is active or cleaned up.
  const emitter = new EventEmitter();
  const pubsub = new PubSub({ eventEmitter: emitter });
  let server: BffServer | undefined;
  let client: Client | undefined;
  let baseUrl = '';
  const graphql = graphQLClient(() => baseUrl);
  const listeners = () => emitter.listenerCount(PRICE_CHANGED);

  beforeAll(async () => {
    const trackerUrl = await listen(tracker);
    server = await createServer({ trackerUrl, pubsub });
    baseUrl = await listen(server.httpServer);
    client = createClient({ url: `${baseUrl.replace('http', 'ws')}/graphql`, webSocketImpl: WebSocket });
  });

  afterAll(async () => {
    await client?.dispose();
    await server?.stop();
    await close(tracker);
  });

  it('delivers a change to subscribers of that product and of all products only', async () => {
    const forProduct = subscribe(client!, { productId: PRODUCT_ID });
    const forAll = subscribe(client!, {});
    const forOther = subscribe(client!, { productId: NEW_PRODUCT_ID });
    await waitUntil(() => listeners() === 3);

    // The fake Tracker's current price is 1500, so 1399 is a change.
    await graphql(RECORD_PRICE, { id: PRODUCT_ID, amount: 1399 });
    await waitUntil(() => forProduct.events.length === 1 && forAll.events.length === 1);

    const expected = {
      data: {
        priceChanged: {
          productId: PRODUCT_ID,
          price: { amount: 1399, currency: 'UAH' },
          previousPrice: { amount: 1500, currency: 'UAH' },
          observedAt: pricePoint.observedAt,
        },
      },
    };
    expect(forProduct.events).toEqual([expected]);
    expect(forAll.events).toEqual([expected]);
    // Give the filtered-out subscription a chance to receive what it should not.
    await sleep(50);
    expect(forOther.events).toEqual([]);

    for (const subscription of [forProduct, forAll, forOther]) subscription.unsubscribe();
    // Unsubscribing on the client removes the server-side listener: no leak per closed tab.
    await waitUntil(() => listeners() === 0);
  });

  it('sends nothing when the recorded price equals the current one', async () => {
    const subscription = subscribe(client!, { productId: PRODUCT_ID });
    await waitUntil(() => listeners() === 1);

    await graphql(RECORD_PRICE, { id: PRODUCT_ID, amount: 1500 });
    await graphql(RECORD_PRICE, { id: PRODUCT_ID, amount: 1450 });
    await waitUntil(() => subscription.events.length === 1);
    await sleep(50);

    expect(subscription.events).toEqual([
      expect.objectContaining({ data: { priceChanged: expect.objectContaining({ price: { amount: 1450, currency: 'UAH' } }) } }),
    ]);
    subscription.unsubscribe();
    await waitUntil(() => listeners() === 0);
  });
});

describe('recordPrice when publishing fails', () => {
  /** Pub/sub whose broker is down. */
  class BrokenPubSub extends PubSub {
    override publish(): Promise<void> {
      return Promise.reject(new Error('Redis is down'));
    }
  }

  const tracker = createFakeTracker([]);
  let server: BffServer | undefined;
  let baseUrl = '';
  const graphql = graphQLClient(() => baseUrl);

  beforeAll(async () => {
    const trackerUrl = await listen(tracker);
    server = await createServer({ trackerUrl, pubsub: new BrokenPubSub() });
    baseUrl = await listen(server.httpServer);
  });

  afterAll(async () => {
    await server?.stop();
    await close(tracker);
  });

  it('still records the price and only logs the publishing error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { body } = await graphql(RECORD_PRICE, { id: PRODUCT_ID, amount: 1399 });

    expect(body.errors).toBeUndefined();
    expect(body.data).toEqual({ recordPrice: { id: pricePoint.id } });
    await waitUntil(() => consoleError.mock.calls.length === 1);
    expect(consoleError).toHaveBeenCalledWith('Failed to publish price change', expect.any(Error));
    consoleError.mockRestore();
  });
});
