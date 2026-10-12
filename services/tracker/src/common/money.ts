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