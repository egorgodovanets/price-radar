import type { QueryResolvers } from './../../../types.generated.js';

export const product: NonNullable<QueryResolvers['product']> = (_parent, { id }, { dataSources }) =>
  dataSources.tracker.getProduct(id);
