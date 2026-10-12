import { isPlainObject } from './validation.js';

export const CURRENCIES = ['UAH', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** A price: amount in major units (hryvnias, euros) plus its currency. */
export interface Money {
  amount: number;
  currency: Currency;
}

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency === value);
}

/** A positive, finite amount in a known currency. */
export function isMoney(value: unknown): value is Money {
  return (
    isPlainObject(value) &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    isCurrency(value.currency)
  );
}

/** Expected shape of Money, for error messages. */
export const MONEY_HINT = `{ amount: number > 0, currency: ${CURRENCIES.join(' | ')} }`;