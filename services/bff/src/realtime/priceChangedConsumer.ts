import type { PubSubEngine } from 'graphql-subscriptions';
import type { Money } from '../dataSources/tracker.types.js';
import { logger } from '../logger.js';
import { publishPriceChanged, type PriceChangedEvent } from './events.js';

/** Kafka topic Tracker publishes to (services/tracker/src/events/priceEvents.ts). */
export const PRICE_CHANGED_TOPIC = 'price.changed';

/**
 * One consumer group for all BFF instances: Kafka hands each event to one of them,
 * and Redis pub/sub then fans it out to the WebSocket clients of every instance.
 */
const CONSUMER_GROUP = 'bff';
const CONNECT_TIMEOUT_MS = 10_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMoney(value: unknown): value is Money {
  return (
    isObject(value) &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    (value.currency === 'UAH' || value.currency === 'EUR')
  );
}

/** Messages come from another service: check them like any untrusted input. */
export function parsePriceChangedMessage(value: Buffer | null | undefined): PriceChangedEvent | null {
  if (!value) return null;

  let data: unknown;
  try {
    data = JSON.parse(value.toString('utf8'));
  } catch {
    return null;
  }
  if (!isObject(data)) return null;

  const { productId, price, previousPrice, observedAt } = data;
  if (
    typeof productId !== 'string' ||
    !isMoney(price) ||
    (previousPrice !== null && !isMoney(previousPrice)) ||
    typeof observedAt !== 'string'
  ) {
    return null;
  }
  return { productId, price, previousPrice, observedAt };
}

/** One Kafka message: a valid event goes to subscribers, anything else is logged and skipped. */
export function handlePriceChangedMessage(pubsub: PubSubEngine, value: Buffer | null | undefined): void {
  const event = parsePriceChangedMessage(value);
  if (!event) {
    // Skip, do not crash: one bad message must not block every message after it.
    logger.warn({ component: 'kafka', raw: value?.toString('utf8') }, 'Skipping a malformed price.changed message');
    return;
  }
  publishPriceChanged(pubsub, event);
}

export interface PriceChangedConsumer {
  stop(): Promise<void>;
}

/** Reads price.changed from Kafka and republishes each event to the GraphQL pub/sub (Redis). */
export async function startPriceChangedConsumer(brokers: string, pubsub: PubSubEngine): Promise<PriceChangedConsumer> {
  // Lazy import: node-rdkafka is a native module, built only inside the Docker image.
  const { default: Kafka } = await import('node-rdkafka');

  const consumer = new Kafka.KafkaConsumer(
    {
      'metadata.broker.list': brokers,
      'group.id': CONSUMER_GROUP,
      'client.id': 'bff',
      // Offsets are committed in the background. A lost or repeated live update is harmless:
      // the browser reloads the data anyway.
      'enable.auto.commit': true,
    },
    // A brand-new group starts at the newest message: browsers want live changes, not old history.
    { 'auto.offset.reset': 'latest' },
  );

  await new Promise<void>((resolve, reject) => {
    consumer.connect({ timeout: CONNECT_TIMEOUT_MS }, (error) =>
      error ? reject(new Error(`Cannot connect to Kafka at ${brokers}: ${error.message}`, { cause: error })) : resolve(),
    );
  });

  consumer.on('data', (message) => handlePriceChangedMessage(pubsub, message.value));
  consumer.on('event.error', (error) => {
    logger.error({ component: 'kafka', err: error }, 'Kafka consumer error');
  });

  consumer.subscribe([PRICE_CHANGED_TOPIC]);
  // Flowing mode: librdkafka fetches in the background and emits 'data' for every message.
  consumer.consume();

  return {
    stop: () => new Promise((resolve) => consumer.disconnect(() => resolve())),
  };
}
