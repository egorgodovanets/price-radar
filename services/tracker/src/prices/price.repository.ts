import { ObjectId, type Collection, type Db } from 'mongodb';
import type { Money } from '../common/money.js';
import type { PricePointDocument } from './price.js';

/** The only place that knows how price history is stored in MongoDB. */
export class PriceRepository {
  private readonly collection: Collection<PricePointDocument>;

  constructor(db: Db) {
    this.collection = db.collection<PricePointDocument>('prices');
  }

  /**
   * Serves "history of one product, newest first": equality on productId, then the sort keys.
   * _id breaks ties between points with the same timestamp, so the order is stable.
   */
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ productId: 1, observedAt: -1, _id: -1 });
  }

  async add(productId: ObjectId, price: Money): Promise<PricePointDocument> {
    const point: PricePointDocument = {
      _id: new ObjectId(),
      productId,
      price,
      observedAt: new Date(),
    };
    await this.collection.insertOne(point);
    return point;
  }

  findByProduct(productId: ObjectId, limit: number): Promise<PricePointDocument[]> {
    return this.collection
      .find({ productId })
      .sort({ observedAt: -1, _id: -1 })
      .limit(limit)
      .toArray();
  }
}