import type { PubSubEngine } from 'graphql-subscriptions';
import type { Money } from '../dataSources/tracker.types.js';

/** Pub/sub channel (a Redis channel in production) for price changes. */
export const PRICE_CHANGED = 'price.changed';

export interface PriceChangedEvent {
  productId: string;
  price: Money;
  /** Null for the first price of a product. */
  previousPrice: Money | null;
  /** ISO 8601. */
  observedAt: string;
}

/**
 * Fire and forget: subscribers are a bonus, so a Redis problem
 * must not fail the request that changed the price.
 */
export function publishPriceChanged(pubsub: PubSubEngine, event: PriceChangedEvent): void {
  pubsub.publish(PRICE_CHANGED, event).catch((error: unknown) => {
    console.error('Failed to publish price change', error);
  });
}
