import type { MutationResolvers } from './../../../types.generated.js';

// Subscribers hear about the change from Tracker via Kafka, not from here:
// the scraper records prices directly in Tracker, bypassing the BFF.
export const recordPrice: NonNullable<MutationResolvers['recordPrice']> = (
  _parent,
  { productId, price },
  { dataSources },
) => dataSources.tracker.recordPrice(productId, { amount: price.amount, currency: price.currency });
