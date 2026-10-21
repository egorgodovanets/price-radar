import type { LibrdKafkaError } from 'node-rdkafka';
import { logger } from '../logger.js';
import { PRICE_CHANGED_TOPIC, type PriceEvents } from './priceEvents.js';

const CONNECT_TIMEOUT_MS = 10_000;
const FLUSH_TIMEOUT_MS = 5_000;

const log = logger.child({ component: 'kafka' });

/**
 * Connects a Kafka producer for price.changed.
 * Fails if the broker cannot be reached: better not to start than to lose events silently.
 */
export async function connectKafkaPriceEvents(brokers: string): Promise<PriceEvents> {
  // Lazy import: node-rdkafka is a native module, built only inside the Docker image.
  // Without KAFKA_BROKERS (e.g. local runs on Windows) it is never loaded.
  const { default: Kafka } = await import('node-rdkafka');

  const producer = new Kafka.Producer({
    'metadata.broker.list': brokers,
    'client.id': 'tracker',
    // Retries after a network error never duplicate or reorder messages.
    'enable.idempotence': true,
    // Ask librdkafka to report the fate of every message (see 'delivery-report').
    dr_cb: true,
  });

  await new Promise<void>((resolve, reject) => {
    producer.connect({ timeout: CONNECT_TIMEOUT_MS }, (error) =>
      error ? reject(new Error(`Cannot connect to Kafka at ${brokers}: ${error.message}`, { cause: error })) : resolve(),
    );
  });
  // Delivery reports arrive only while the producer is polled.
  producer.setPollInterval(100);

  producer.on('delivery-report', (error) => {
    if (error) log.error({ err: error }, 'Kafka did not accept a price change');
  });
  producer.on('event.error', (error) => {
    log.error({ err: error }, 'Kafka producer error');
  });

  return {
    priceChanged(event) {
      try {
        // produce() only puts the message into librdkafka's buffer; it is sent in the background.
        producer.produce(
          PRICE_CHANGED_TOPIC,
          null, // partition: chosen from the key
          Buffer.from(JSON.stringify(event)),
          event.productId,
          Date.parse(event.observedAt),
        );
      } catch (error) {
        // E.g. the local buffer is full because the broker has been down for long.
        log.error({ err: error, productId: event.productId }, 'Failed to publish price change');
      }
    },

    close() {
      return new Promise((resolve) => {
        producer.flush(FLUSH_TIMEOUT_MS, (error: LibrdKafkaError | undefined) => {
          if (error) log.error({ err: error }, 'Kafka flush failed, some price changes may be lost');
          producer.disconnect(() => resolve());
        });
      });
    },
  };
}
