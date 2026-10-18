import type { Money } from '../common/money.js';

/**
 * Kafka topic for price changes. The message key is the product id: Kafka keeps order
 * only inside one partition, and one key always goes to the same partition,
 * so the changes of one product are read in the order they happened.
 */
export const PRICE_CHANGED_TOPIC = 'price.changed';

/** Message value, as JSON. Read by the BFF (live updates) and Notifications (Telegram). */
export interface PriceChangedEvent {
  productId: string;
  price: Money;
  /** Null for the first price of a product. */
  previousPrice: Money | null;
  /** ISO 8601. */
  observedAt: string;
}

/** Where Tracker announces price changes. */
export interface PriceEvents {
  /** Fire and forget: never throws, problems are logged. */
  priceChanged(event: PriceChangedEvent): void;
  /** Sends what is still buffered, then disconnects. */
  close(): Promise<void>;
}

/** Without KAFKA_BROKERS: Tracker works on its own and nobody hears about changes. */
export const disabledPriceEvents: PriceEvents = {
  priceChanged() {},
  close: () => Promise.resolve(),
};
