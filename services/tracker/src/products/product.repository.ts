import { MongoServerError, ObjectId, type Collection, type Db } from 'mongodb';
import type { CreateProductInput, ProductDocument } from './product.js';

const DUPLICATE_KEY_ERROR = 11000;
const OBJECT_ID_HEX = /^[a-f\d]{24}$/i;

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
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR) {
        throw new DuplicateProductError(input.url);
      }
      throw error;
    }
    return product;
  }

  findAll(): Promise<ProductDocument[]> {
    return this.collection.find().sort({ createdAt: -1 }).toArray();
  }

  findById(id: string): Promise<ProductDocument | null> {
    if (!OBJECT_ID_HEX.test(id)) return Promise.resolve(null);
    return this.collection.findOne({ _id: new ObjectId(id) });
  }
}