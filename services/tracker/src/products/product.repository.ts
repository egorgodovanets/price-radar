import { ObjectId, type Collection, type Db } from 'mongodb';
import { isDuplicateKeyError, toObjectId } from '../common/mongo.js';
import type { CreateProductInput, ProductDocument } from './product.js';
import type { Money } from '../common/money.js';

export class DuplicateProductError extends Error {
  constructor(url: string) {
    super(`Product with url "${url}" already exists`);
    this.name = 'DuplicateProductError';
  }
}

/** The only place that knows how products are stored in MongoDB. */
export class ProductRepository {
  private readonly collection: Collection<ProductDocument>;

  constructor(db: Db) {
    this.collection = db.collection<ProductDocument>('products');
  }

  /** One product per URL; the unique index makes MongoDB enforce it. */
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ url: 1 }, { unique: true });
  }

  async create(input: CreateProductInput): Promise<ProductDocument> {
    const product: ProductDocument = { _id: new ObjectId(), ...input, createdAt: new Date() };
    try {
      await this.collection.insertOne(product);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new DuplicateProductError(input.url);
      throw error;
    }
    return product;
  }

    /**
   * Stores a copy of the latest price on the product, so lists do not read the history.
   * The filter skips the update if the product already has a newer price.
   */
  async updateCurrentPrice(id: ObjectId, price: Money, at: Date): Promise<void> {
    await this.collection.updateOne(
      { _id: id, $or: [{ priceUpdatedAt: { $exists: false } }, { priceUpdatedAt: { $lte: at } }] },
      { $set: { currentPrice: price, priceUpdatedAt: at } },
    );
  }

  findAll(): Promise<ProductDocument[]> {
    return this.collection.find().sort({ createdAt: -1 }).toArray();
  }

  findById(id: string): Promise<ProductDocument | null> {
    const _id = toObjectId(id);
    if (!_id) return Promise.resolve(null);
    return this.collection.findOne({ _id });
  }
}