import { ObjectId, type Collection, type Db, type Filter } from 'mongodb';
import { isDuplicateKeyError, toObjectId } from '../common/mongo.js';
import type { CreateWatchInput, WatchDocument } from './watch.js';

export class DuplicateWatchError extends Error {
  constructor() {
    super('This chat already watches this product');
    this.name = 'DuplicateWatchError';
  }
}

/** The only place that knows how watches are stored in MongoDB. */
export class WatchRepository {
  private readonly collection: Collection<WatchDocument>;

  constructor(db: Db) {
    this.collection = db.collection<WatchDocument>('watches');
  }

  /**
   * One watch per (product, chat). The same index also serves "all watches of a product"
   * lookups, because productId is its first field.
   */
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ productId: 1, chatId: 1 }, { unique: true });
  }

  async create(input: CreateWatchInput): Promise<WatchDocument> {
    const watch: WatchDocument = {
      _id: new ObjectId(),
      productId: new ObjectId(input.productId),
      chatId: input.chatId,
      targetPrice: input.targetPrice,
      createdAt: new Date(),
    };
    try {
      await this.collection.insertOne(watch);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new DuplicateWatchError();
      throw error;
    }
    return watch;
  }

  async find(filter: { productId?: string | undefined } = {}): Promise<WatchDocument[]> {
    const query: Filter<WatchDocument> = {};
    if (filter.productId !== undefined) {
      const productId = toObjectId(filter.productId);
      if (!productId) return [];
      query.productId = productId;
    }
    return this.collection.find(query).sort({ createdAt: -1 }).toArray();
  }

  /** Returns false when there was nothing to delete. */
  async deleteById(id: string): Promise<boolean> {
    const _id = toObjectId(id);
    if (!_id) return false;
    const { deletedCount } = await this.collection.deleteOne({ _id });
    return deletedCount === 1;
  }
}