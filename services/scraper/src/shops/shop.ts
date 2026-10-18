import type { Currency, Money } from '../money.js';
import type { RawOffer } from './structuredData.js';

/** One adapter per shop: every shop marks up its prices differently. */
export interface Shop {
  name: string;
  /** Hostnames without "www.". */
  hosts: readonly string[];
  /** The only currency this shop sells in. */
  currency: Currency;
  /** Reads the current price from a product page; throws PriceNotFoundError. */
  readPrice(html: string): Money;
}

/** The page loaded, but no usable price was found: the layout changed or the product is gone. */
export class PriceNotFoundError extends Error {
  constructor(shop: string, reason: string) {
    super(`${shop}: ${reason}`);
    this.name = 'PriceNotFoundError';
  }
}

/** "105", "349.00", 349 or "1 450,50" -> a positive number; anything else -> NaN. */
export function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return raw > 0 ? raw : Number.NaN;
  if (typeof raw !== 'string') return Number.NaN;

  const normalized = raw.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  const amount = Number(normalized);
  return amount > 0 ? amount : Number.NaN;
}

/** Turns what the page says into Money, or explains why it cannot. */
export function toMoney(offer: RawOffer | null, shop: Pick<Shop, 'name' | 'currency'>): Money {
  if (!offer) throw new PriceNotFoundError(shop.name, 'no price on the page');

  const amount = parseAmount(offer.price);
  if (Number.isNaN(amount)) {
    throw new PriceNotFoundError(shop.name, `unreadable price ${JSON.stringify(offer.price)}`);
  }
  // A missing currency is fine (the shop has one); a different one is a layout change worth noticing.
  if (offer.currency !== undefined && offer.currency !== shop.currency) {
    throw new PriceNotFoundError(shop.name, `expected ${shop.currency}, page says ${JSON.stringify(offer.currency)}`);
  }
  return { amount, currency: shop.currency };
}
