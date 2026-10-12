import { describe, expect, it, jest } from '@jest/globals';
import { ObjectId } from 'mongodb';
import type { ProductDocument } from '../products/product.js';
import type { CreateWatchInput, WatchDocument } from './watch.js';
import { ProductNotFoundError, WatchService, type WatchServiceDeps } from './watch.service.js';

// The service is tested with fake repositories: no MongoDB, no HTTP, only business rules.
type Products = WatchServiceDeps['products'];
type Watches = WatchServiceDeps['watches'];

const input: CreateWatchInput = {
  productId: '6ac1219c8ffe84939f69873e',
  chatId: '123456789',
  targetPrice: { amount: 1500, currency: 'UAH' },
};

const product: ProductDocument = {
  _id: new ObjectId(input.productId),
  title: 'Yoga mat',
  url: 'https://troli.shop/ua/yoga-mat',
  category: 'sport',
  attributes: {},
  createdAt: new Date(),
};

const watch: WatchDocument = {
  _id: new ObjectId(),
  productId: new ObjectId(input.productId),
  chatId: input.chatId,
  targetPrice: input.targetPrice,
  createdAt: new Date(),
};

function setup({ productExists }: { productExists: boolean }) {
  const products = {
    findById: jest.fn<Products['findById']>().mockResolvedValue(productExists ? product : null),
  };
  const watches = {
    create: jest.fn<Watches['create']>().mockResolvedValue(watch),
    find: jest.fn<Watches['find']>().mockResolvedValue([watch]),
    deleteById: jest.fn<Watches['deleteById']>().mockResolvedValue(true),
  };
  return { service: new WatchService({ products, watches }), products, watches };
}

describe('WatchService', () => {
  it('creates a watch when the product exists', async () => {
    const { service, products, watches } = setup({ productExists: true });

    await expect(service.create(input)).resolves.toBe(watch);
    expect(products.findById).toHaveBeenCalledWith(input.productId);
    expect(watches.create).toHaveBeenCalledWith(input);
  });

  it('refuses to watch a product that does not exist', async () => {
    const { service, watches } = setup({ productExists: false });

    await expect(service.create(input)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(watches.create).not.toHaveBeenCalled();
  });

  it('lists watches, optionally filtered by product', async () => {
    const { service, watches } = setup({ productExists: true });

    await expect(service.list(input.productId)).resolves.toEqual([watch]);
    expect(watches.find).toHaveBeenCalledWith({ productId: input.productId });
  });

  it('removes a watch by id', async () => {
    const { service, watches } = setup({ productExists: true });
    const id = watch._id.toHexString();

    await expect(service.remove(id)).resolves.toBe(true);
    expect(watches.deleteById).toHaveBeenCalledWith(id);
  });
});
