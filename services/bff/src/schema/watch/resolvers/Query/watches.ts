import type { QueryResolvers } from './../../../types.generated.js';

export const watches: NonNullable<QueryResolvers['watches']> = (_parent, { productId }, { dataSources }) =>
  // An omitted or null argument means "all watches".
  dataSources.tracker.getWatches(productId ?? undefined);
