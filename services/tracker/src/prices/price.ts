import type { ObjectId } from 'mongodb';
import type { Money } from '../common/money.js';

/** One observed price of a product. Points are only added, never changed. */
export interface PricePointDocument {
  _id: ObjectId;
  productId: ObjectId;
  price: Money;
  observedAt: Date;
}

/** Shape returned by the REST API. */
export interface PricePointDto {
  id: string;
  productId: string;
  price: Money;
  observedAt: string;
}

export function toPricePointDto({ _id, productId, price, observedAt }: PricePointDocument): PricePointDto {
  return {
    id: _id.toHexString(),
    productId: productId.toHexString(),
    price,
    observedAt: observedAt.toISOString(),
  };
}