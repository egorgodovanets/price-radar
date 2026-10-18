import type { Currency, Money } from '../common/money.js';
import type { PriceEvents } from '../events/priceEvents.js';
import { ProductNotFoundError } from '../products/product.js';
import type { ProductRepository } from '../products/product.repository.js';
import type { PricePointDocument } from './price.js';
import type { PriceRepository } from './price.repository.js';

export class CurrencyMismatchError extends Error {
  constructor(expected: Currency, received: Currency) {
    super(`Product is priced in ${expected}, got ${received}`);
    this.name = 'CurrencyMismatchError';
  }
}

/** Only the methods the service uses, so tests can pass simple fakes. */
export interface PriceServiceDeps {
  products: Pick<ProductRepository, 'findById' | 'updateCurrentPrice'>;
  prices: Pick<PriceRepository, 'add' | 'findByProduct'>;
  events: Pick<PriceEvents, 'priceChanged'>;
}

/** Business rules for price history. Knows nothing about HTTP or MongoDB. */
export class PriceService {
  private readonly products: PriceServiceDeps['products'];
  private readonly prices: PriceServiceDeps['prices'];
  private readonly events: PriceServiceDeps['events'];

  constructor(deps: PriceServiceDeps) {
    this.products = deps.products;
    this.prices = deps.prices;
    this.events = deps.events;
  }

  /**
   * Appends a point to the history, then refreshes the product's current price.
   * Two writes without a transaction: the history is the source of truth,
   * so if the second write fails, the current price can be rebuilt from it.
   * If the amount changed, announces it to other services (after the writes, so readers see the new data).
   */
  async record(productId: string, price: Money): Promise<PricePointDocument> {
    const product = await this.products.findById(productId);
    if (!product) throw new ProductNotFoundError(productId);

    // One product, one currency: mixed currencies would make the history meaningless.
    const currency = product.currentPrice?.currency;
    if (currency && currency !== price.currency) {
      throw new CurrencyMismatchError(currency, price.currency);
    }

    const point = await this.prices.add(product._id, price);
    await this.products.updateCurrentPrice(product._id, point.price, point.observedAt);

    const previousPrice = product.currentPrice ?? null;
    if (previousPrice?.amount !== point.price.amount) {
      // Not atomic with the writes: if Tracker dies right here, the event is lost.
      // The transactional outbox pattern fixes that; for price alerts an occasional miss is acceptable.
      this.events.priceChanged({
        productId: product._id.toHexString(),
        price: point.price,
        previousPrice,
        observedAt: point.observedAt.toISOString(),
      });
    }
    return point;
  }

  async history(productId: string, limit: number): Promise<PricePointDocument[]> {
    const product = await this.products.findById(productId);
    if (!product) throw new ProductNotFoundError(productId);
    return this.prices.findByProduct(product._id, limit);
  }
}
