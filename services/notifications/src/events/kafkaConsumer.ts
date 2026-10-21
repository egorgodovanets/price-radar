import type { Message } from 'node-rdkafka';
import { logger } from '../logger.js';
import type { MessageSource } from './consumeLoop.js';
import { PRICE_CHANGED_TOPIC } from './priceChanged.js';

/**
 * Own consumer group: Notifications gets every event independently of BFF ("bff" group).
 * Several Notifications instances would share the partitions, so each alert is sent once.
 */
const CONSUMER_GROUP = 'notifications';
const CONNECT_TIMEOUT_MS = 10_000;

export interface KafkaSource extends MessageSource<Message> {
  close(): Promise<void>;
}

/** Connects a Kafka consumer for price.changed that commits offsets only when told to. */
export async function connectPriceChangedSource(brokers: string): Promise<KafkaSource> {
  // Lazy import: node-rdkafka is a native module, built only inside the Docker image.
  const { default: Kafka } = await import('node-rdkafka');

  const consumer = new Kafka.KafkaConsumer(
    {
      'metadata.broker.list': brokers,
      'group.id': CONSUMER_GROUP,
      'client.id': 'notifications',
      // Manual commits, after an alert was handled (see startConsumeLoop). Unlike BFF,
      // a lost message here is a lost notification the user never receives.
      'enable.auto.commit': false,
    },
    // Only for the group's very first start: do not send alerts for old history.
    // After that the group resumes from its committed offset, so events published
    // while the service was down are still delivered.
    { 'auto.offset.reset': 'latest' },
  );

  await new Promise<void>((resolve, reject) => {
    consumer.connect({ timeout: CONNECT_TIMEOUT_MS }, (error) =>
      error ? reject(new Error(`Cannot connect to Kafka at ${brokers}: ${error.message}`, { cause: error })) : resolve(),
    );
  });
  consumer.on('event.error', (error) => {
    logger.error({ err: error, component: 'kafka' }, 'Kafka consumer error');
  });
  consumer.subscribe([PRICE_CHANGED_TOPIC]);

  return {
    // Non-flowing mode: one message per call (waits up to 1 s), so the next one is read
    // only after the previous one was handled and committed.
    next: () =>
      new Promise((resolve, reject) => {
        consumer.consume(1, (error, messages) =>
          error ? reject(new Error(`Kafka consume failed: ${error.message}`, { cause: error })) : resolve(messages),
        );
      }),
    // Synchronous: the commit is done before the next message is read and before disconnect.
    // Commits offset + 1, i.e. "continue after this message".
    commit: (message) => consumer.commitMessageSync(message),
    close: () => new Promise((resolve) => consumer.disconnect(() => resolve())),
  };
}
