import { EventEmitter } from 'node:events';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { PubSub } from 'graphql-subscriptions';
import { createClient, type Client } from 'graphql-ws';
import WebSocket from 'ws';
import { PRICE_CHANGED, type PriceChangedEvent } from './realtime/events.js';
import { handlePriceChangedMessage } from './realtime/priceChangedConsumer.js';
import { createServer, type BffServer } from './server.js';
import { close, createFakeTracker, listen, NEW_PRODUCT_ID, PRODUCT_ID } from './testing/fakeTracker.js';

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

const change: PriceChangedEvent = {
  productId: PRODUCT_ID,
  price: { amount: 1399, currency: 'UAH' },
  previousPrice: { amount: 1500, currency: 'UAH' },
  observedAt: '2026-10-13T10:00:00.000Z',
};

/** The value of a Kafka message, as Tracker would send it. */
const kafkaMessage = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));

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
  const listeners = () => emitter.listenerCount(PRICE_CHANGED);

  beforeAll(async () => {
    const trackerUrl = await listen(tracker);
    server = await createServer({ trackerUrl, pubsub });
    const baseUrl = await listen(server.httpServer);
    client = createClient({ url: `${baseUrl.replace('http', 'ws')}/graphql`, webSocketImpl: WebSocket });
  });

  afterAll(async () => {
    await client?.dispose();
    await server?.stop();
    await close(tracker);
  });

  it('delivers a Kafka event to subscribers of that product and of all products only', async () => {
    const forProduct = subscribe(client!, { productId: PRODUCT_ID });
    const forAll = subscribe(client!, {});
    const forOther = subscribe(client!, { productId: NEW_PRODUCT_ID });
    await waitUntil(() => listeners() === 3);

    handlePriceChangedMessage(pubsub, kafkaMessage(change));
    await waitUntil(() => forProduct.events.length === 1 && forAll.events.length === 1);

    const expected = { data: { priceChanged: change } };
    expect(forProduct.events).toEqual([expected]);
    expect(forAll.events).toEqual([expected]);
    // Give the filtered-out subscription a chance to receive what it should not.
    await sleep(50);
    expect(forOther.events).toEqual([]);

    for (const subscription of [forProduct, forAll, forOther]) subscription.unsubscribe();
    // Unsubscribing on the client removes the server-side listener: no leak per closed tab.
    await waitUntil(() => listeners() === 0);
  });

  it('skips a malformed message and keeps delivering the next ones', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const subscription = subscribe(client!, {});
    await waitUntil(() => listeners() === 1);

    handlePriceChangedMessage(pubsub, kafkaMessage('not json'));
    handlePriceChangedMessage(pubsub, kafkaMessage({ ...change, price: { amount: 'cheap', currency: 'UAH' } }));
    handlePriceChangedMessage(pubsub, kafkaMessage({ ...change, previousPrice: null }));
    await waitUntil(() => subscription.events.length === 1);
    await sleep(50);

    expect(subscription.events).toEqual([{ data: { priceChanged: { ...change, previousPrice: null } } }]);
    expect(consoleWarn).toHaveBeenCalledTimes(2);
    consoleWarn.mockRestore();
    subscription.unsubscribe();
    await waitUntil(() => listeners() === 0);
  });
});

describe('Kafka message to pub/sub', () => {
  /** Pub/sub whose broker is down. */
  class BrokenPubSub extends PubSub {
    override publish(): Promise<void> {
      return Promise.reject(new Error('Redis is down'));
    }
  }

  it('only logs when Redis is down, so the consumer keeps running', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => handlePriceChangedMessage(new BrokenPubSub(), kafkaMessage(change))).not.toThrow();

    await waitUntil(() => consoleError.mock.calls.length === 1);
    expect(consoleError).toHaveBeenCalledWith('Failed to publish price change', expect.any(Error));
    consoleError.mockRestore();
  });
});
