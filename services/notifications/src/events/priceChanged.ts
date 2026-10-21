import type { Money } from '../money.js';

/** Kafka topic Tracker publishes to (services/tracker/src/events/priceEvents.ts). */
export const PRICE_CHANGED_TOPIC = 'price.changed';

/** Same shape Tracker publishes; Notifications keeps its own copy of the contract. */
export interface PriceChangedEvent {
  productId: string;
  price: Money;
  /** null for the very first price of a product. */
  previousPrice: Money | null;
  observedAt: string;
}

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
