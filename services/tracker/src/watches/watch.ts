import type { ObjectId } from 'mongodb';
import type { Money } from '../common/money.js';

/** Fields a client sends to start watching a product. */
export interface CreateWatchInput {
  productId: string;
  /** Telegram chat that receives the notification. */
  chatId: string;
  /** Notify when the price drops to this value or below. */
  targetPrice: Money;
}

/** Shape stored in the "watches" collection. */
export interface WatchDocument {
  _id: ObjectId;
  productId: ObjectId;
  chatId: string;
  targetPrice: Money;
  createdAt: Date;
}

/** Shape returned by the REST API. */
export interface WatchDto {
  id: string;
  productId: string;
  chatId: string;
  targetPrice: Money;
  createdAt: string;
}

export function toWatchDto({ _id, productId, createdAt, ...fields }: WatchDocument): WatchDto {
  return {
    id: _id.toHexString(),
    productId: productId.toHexString(),
    ...fields,
    createdAt: createdAt.toISOString(),
  };
}