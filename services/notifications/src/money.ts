/**
 * Same shape as Money in the Tracker API: amount in major units plus currency.
 * Each service keeps its own copy of the contract types; they change rarely.
 */
export type Currency = 'UAH' | 'EUR';

export interface Money {
  amount: number;
  currency: Currency;
}
