import type { ProductRepository } from '../products/product.repository.js';
import type { CreateWatchInput, WatchDocument } from './watch.js';
import type { WatchRepository } from './watch.repository.js';
import { ProductNotFoundError } from '../products/product.js';

/** Only the methods the service uses, so tests can pass simple fakes. */
export interface WatchServiceDeps {
  products: Pick<ProductRepository, 'findById'>;
  watches: Pick<WatchRepository, 'create' | 'find' | 'deleteById'>;
}

/** Business rules for watches. Knows nothing about HTTP or MongoDB. */
export class WatchService {
  private readonly products: WatchServiceDeps['products'];
  private readonly watches: WatchServiceDeps['watches'];

  constructor(deps: WatchServiceDeps) {
    this.products = deps.products;
    this.watches = deps.watches;
  }

  /** A watch must point to an existing product: MongoDB has no foreign keys to check it. */
  async create(input: CreateWatchInput): Promise<WatchDocument> {
    const product = await this.products.findById(input.productId);
    if (!product) throw new ProductNotFoundError(input.productId);
    return this.watches.create(input);
  }

  list(productId?: string): Promise<WatchDocument[]> {
    return this.watches.find({ productId });
  }

  remove(id: string): Promise<boolean> {
    return this.watches.deleteById(id);
  }
}