import type { TrackerAPI } from './dataSources/TrackerAPI.js';

/** Third argument of every resolver. Built fresh for each GraphQL operation in server.ts. */
export interface GraphQLContext {
  dataSources: {
    tracker: TrackerAPI;
  };
}
