import http from 'node:http';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { PubSubEngine } from 'graphql-subscriptions';
import { useServer } from 'graphql-ws/use/ws';
import { WebSocketServer } from 'ws';
import type { Config } from './config.js';
import type { GraphQLContext } from './context.js';
import { TrackerAPI } from './dataSources/TrackerAPI.js';
import { typeDefs } from './schema/typeDefs.generated.js';
import { resolvers } from './schema/resolvers.generated.js';

/**
 * What createServer needs. The port is chosen by whoever calls listen();
 * the pub/sub is passed in, so tests can use an in-memory one instead of Redis.
 */
export type ServerOptions = Pick<Config, 'trackerUrl'> & { pubsub: PubSubEngine };

export interface BffServer {
  /** HTTP server for the Express app and the WebSocket endpoint. */
  httpServer: http.Server;
  /** Closes WebSocket connections, waits for in-flight HTTP requests, closes the HTTP server. */
  stop(): Promise<void>;
}

/**
 * Assembles the BFF: executable schema, Express app, HTTP server, Apollo Server
 * (GET /health, POST /graphql) and a graphql-ws server for subscriptions on ws://.../graphql.
 * Does not call listen(): the caller picks the port (index.ts uses config, tests use port 0).
 */
export async function createServer({ trackerUrl, pubsub }: ServerOptions): Promise<BffServer> {
  // One schema object for both transports: queries and mutations over HTTP, subscriptions over WebSocket.
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const app = express();
  // Own the HTTP server instead of app.listen(), so Apollo can drain it and ws can attach to it.
  const httpServer = http.createServer(app);

  // Same port and path as HTTP: the WebSocket handshake starts as an HTTP "Upgrade" request.
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });

  // Filled in after Apollo starts; WebSocket operations need its cache for data sources.
  let createContext: () => GraphQLContext = () => {
    throw new Error('BFF is not started yet');
  };

  // Runs the graphql-ws protocol on top of ws; context is built per subscribe message.
  const wsCleanup = useServer({ schema, context: () => createContext() }, wsServer);

  const apollo = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [
      // On apollo.stop(): stop accepting connections, wait for in-flight requests, close the server.
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // On apollo.stop(): also close open WebSocket connections, which HTTP draining does not know about.
      {
        serverWillStart() {
          return Promise.resolve({
            async drainServer() {
              await wsCleanup.dispose();
            },
          });
        },
      },
    ],
  });
  // Must finish before expressMiddleware() is mounted.
  await apollo.start();

  // Data sources are per operation: their request deduplication must not leak between users.
  createContext = () => ({
    dataSources: { tracker: new TrackerAPI(trackerUrl, { cache: apollo.cache }) },
    pubsub,
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // express.json() parses the POST body into req.body, which Apollo reads the operation from.
  app.use('/graphql', express.json(), expressMiddleware(apollo, { context: () => Promise.resolve(createContext()) }));

  return {
    httpServer,
    stop: () => apollo.stop(),
  };
}
