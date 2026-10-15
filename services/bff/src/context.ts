import type { PubSubEngine } from 'graphql-subscriptions';
import type { TrackerAPI } from './dataSources/TrackerAPI.js';

/**
 * Third argument of every resolver. Built fresh for each GraphQL operation in server.ts,
 * over HTTP and over WebSocket alike.
 */
export interface GraphQLContext {
  dataSources: {
    tracker: TrackerAPI;
  };
  /** Shared by all operations: subscriptions listen here, mutations publish here. */
  pubsub: PubSubEngine;
}
