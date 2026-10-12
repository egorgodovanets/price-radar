import type { ProductResolvers } from './../../types.generated.js';

/** Only fields whose shape differs from Tracker's JSON need a resolver; the rest are read as is. */
export const Product: ProductResolvers = {
  attributes: ({ attributes }) =>
    Object.entries(attributes).map(([name, value]) => ({ name, value: String(value) })),

  // Fetched only when the query asks for the field.
  priceHistory: ({ id }, { limit }, { dataSources }) =>
    dataSources.tracker.getPriceHistory(id, limit),

  watches: ({ id }, _args, { dataSources }) => dataSources.tracker.getWatches(id),
};
