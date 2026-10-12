import { describe, expect, it, jest } from '@jest/globals';
import { ObjectId } from 'mongodb';
import type { Money } from '../common/money.js';
import { ProductNotFoundError, type ProductDocument } from '../products/product.js';
import type { PricePointDocument } from './price.js';
import { CurrencyMismatchError, PriceService, type PriceServiceDeps } from './price.service.js';

// Fake repositories again: only the business rules are under test.
type Products = PriceServiceDeps['products'];
type Prices = PriceServiceDeps['prices'];

const productId = '6ac1219c8ffe84939f69873e';
const price: Money = { amount: 1500, currency: 'UAH' };

const product: ProductDocument = {
  _id: new ObjectId(productId),
  title: 'Yoga mat',
  url: 'https://troli.shop/ua/yoga-mat',
  category: 'sport',
  attributes: {},
  createdAt: new Date(),
};

const point: PricePointDocument = {
  _id: new ObjectId(),
  productId: product._id,
  price,
  observedAt: new Date(),
};

function setup(found: ProductDocument | null) {
  const products = {
    findById: jest.fn<Products['findById']>().mockResolvedValue(found),
    updateCurrentPrice: jest.fn<Products['updateCurrentPrice']>().mockResolvedValue(undefined),
  };
  const prices = {
    add: jest.fn<Prices['add']>().mockResolvedValue(point),
    findByProduct: jest.fn<Prices['findByProduct']>().mockResolvedValue([point]),
  };
  return { service: new PriceService({ products, prices }), products, prices };
}

describe('PriceService', () => {
  it('records a point and copies it to the product as the current price', async () => {
    const { service, products, prices } = setup(product);

    await expect(service.record(productId, price)).resolves.toBe(point);
    expect(prices.add).toHaveBeenCalledWith(product._id, price);
    expect(products.updateCurrentPrice).toHaveBeenCalledWith(product._id, price, point.observedAt);
  });

  it('accepts a new price in the same currency', async () => {
    const { service, prices } = setup({ ...product, currentPrice: { amount: 1700, currency: 'UAH' } });

    await expect(service.record(productId, price)).resolves.toBe(point);
    expect(prices.add).toHaveBeenCalled();
  });

  it('refuses a price in another currency and writes nothing', async () => {
    const { service, products, prices } = setup({
      ...product,
      currentPrice: { amount: 50, currency: 'EUR' },
    });

    await expect(service.record(productId, price)).rejects.toBeInstanceOf(CurrencyMismatchError);
    expect(prices.add).not.toHaveBeenCalled();
    expect(products.updateCurrentPrice).not.toHaveBeenCalled();
  });

  it('refuses to record a price of an unknown product', async () => {
    const { service, prices } = setup(null);

    await expect(service.record(productId, price)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(prices.add).not.toHaveBeenCalled();
  });

  it('reads the history of a product', async () => {
    const { service, prices } = setup(product);

    await expect(service.history(productId, 10)).resolves.toEqual([point]);
    expect(prices.findByProduct).toHaveBeenCalledWith(product._id, 10);
  });

  it('refuses to read the history of an unknown product', async () => {
    const { service, prices } = setup(null);

    await expect(service.history(productId, 10)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(prices.findByProduct).not.toHaveBeenCalled();
  });
});
