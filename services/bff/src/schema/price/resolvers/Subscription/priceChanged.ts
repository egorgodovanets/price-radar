import { withFilter } from 'graphql-subscriptions';
import type { GraphQLContext } from '../../../../context.js';
import { PRICE_CHANGED, type PriceChangedEvent } from '../../../../realtime/events.js';
import type { SubscriptionpriceChangedArgs, SubscriptionResolvers } from './../../../types.generated.js';

type Args = Partial<SubscriptionpriceChangedArgs>;

/** No productId: every product. */
function isRequested(event: PriceChangedEvent, { productId }: Args): boolean {
  return !productId || event.productId === productId;
}

export const priceChanged: NonNullable<SubscriptionResolvers['priceChanged']> = {
  // subscribe returns an async iterator of events; withFilter drops events
  // of other products before they reach this client.
  subscribe: withFilter<unknown, Args, GraphQLContext>(
    (_parent, _args, context) => context!.pubsub.asyncIterableIterator<PriceChangedEvent>(PRICE_CHANGED),
    (event, args) => isRequested(event as PriceChangedEvent, args ?? {}),
  ),
  // Each event is the field value itself (by default GraphQL would read event.priceChanged).
  resolve: (event: PriceChangedEvent) => event,
};
