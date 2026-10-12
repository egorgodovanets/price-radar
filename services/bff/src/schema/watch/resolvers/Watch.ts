import { GraphQLError } from 'graphql';
import type { WatchResolvers } from './../../types.generated.js';

export const Watch: WatchResolvers = {
  // Tracker returns only productId. For a list of watches of one product,
  // the identical GETs run at the same time and TrackerAPI sends just one.
  product: async ({ productId }, _args, { dataSources }) => {
    const product = await dataSources.tracker.getProduct(productId);
    if (!product) {
      throw new GraphQLError(`Product "${productId}" not found`, { extensions: { code: 'NOT_FOUND' } });
    }
    return product;
  },
};
