import { publishPriceChanged } from '../../../../realtime/events.js';
import type { MutationResolvers } from './../../../types.generated.js';

export const recordPrice: NonNullable<MutationResolvers['recordPrice']> = async (
  _parent,
  { productId, price },
  { dataSources, pubsub },
) => {
  // Temporary until Tracker publishes price changes to Kafka (next step):
  // only prices recorded through the BFF reach subscribers.
  const before = await dataSources.tracker.getProduct(productId);
  const point = await dataSources.tracker.recordPrice(productId, { amount: price.amount, currency: price.currency });

  const previousPrice = before?.currentPrice ?? null;
  if (previousPrice?.amount !== point.price.amount) {
    publishPriceChanged(pubsub, {
      productId: point.productId,
      price: point.price,
      previousPrice,
      observedAt: point.observedAt,
    });
  }
  return point;
};
