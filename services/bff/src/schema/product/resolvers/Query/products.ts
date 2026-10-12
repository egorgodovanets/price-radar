import type { QueryResolvers } from './../../../types.generated.js';

export const products: NonNullable<QueryResolvers['products']> = (_parent, _args, { dataSources }) =>
  dataSources.tracker.getProducts();
