import type { ObjectId } from 'mongodb';

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

/** Shape stored in the "products" collection. */
export interface ProductDocument extends CreateProductInput {
  _id: ObjectId;
  createdAt: Date;
}

/** Shape returned by the REST API. */
export interface ProductDto extends CreateProductInput {
  id: string;
  createdAt: string;
}

export function toProductDto({ _id, createdAt, ...fields }: ProductDocument): ProductDto {
  return { id: _id.toHexString(), ...fields, createdAt: createdAt.toISOString() };
}