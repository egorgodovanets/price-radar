import type { ObjectId } from 'mongodb';
import type { Money } from '../common/money.js';

export const CATEGORIES = ['sport', 'electronics'] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Category-specific details with no fixed schema,
 * e.g. { color: 'blue', thicknessMm: 6 } for sport or { storageGb: 128 } for electronics.
 */
export type ProductAttributes = Record<string, string | number | boolean>;

/** Fields a client sends to create a product. */
export interface CreateProductInput {
  title: string;
  url: string;
  category: Category;
  attributes: ProductAttributes;
}

export interface ProductDocument extends CreateProductInput {
  _id: ObjectId;
  createdAt: Date;
  /** Copy of the latest price point; absent until the first price is recorded. */
  currentPrice?: Money;
  priceUpdatedAt?: Date;
}

export interface ProductDto extends CreateProductInput {
  id: string;
  currentPrice: Money | null;
  priceUpdatedAt: string | null;
  createdAt: string;
}

export function toProductDto({
  _id,
  createdAt,
  currentPrice,
  priceUpdatedAt,
  ...fields
}: ProductDocument): ProductDto {
  return {
    id: _id.toHexString(),
    ...fields,
    currentPrice: currentPrice ?? null,
    priceUpdatedAt: priceUpdatedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
  };
}

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product "${productId}" not found`);
    this.name = 'ProductNotFoundError';
  }
}