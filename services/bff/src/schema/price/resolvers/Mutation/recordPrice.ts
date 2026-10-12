import type { MutationResolvers } from './../../../types.generated.js';

export const recordPrice: NonNullable<MutationResolvers['recordPrice']> = (
  _parent,
  { productId, price },
  { dataSources },
) => dataSources.tracker.recordPrice(productId, { amount: price.amount, currency: price.currency });
