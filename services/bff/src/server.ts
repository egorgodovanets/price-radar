import http from 'node:http';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema/typeDefs.generated.js';
import { resolvers } from './schema/resolvers.generated.js';

export interface BffServer {
  /** HTTP server wrapping the Express app; WebSocket subscriptions will attach to it later. */
  httpServer: http.Server;
  /** Stops Apollo Server and closes the HTTP server after in-flight requests finish. */
  stop(): Promise<void>;
}

/**
 * Assembles the BFF: executable schema, Express app, HTTP server and Apollo Server
 * with GET /health and POST /graphql routes.
 * Does not call listen(): the caller picks the port (index.ts uses config, tests use port 0).
 */
export async function createServer(): Promise<BffServer> {
  // One schema object for every transport: HTTP now, WebSocket subscriptions later.
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const app = express();
  // Own the HTTP server instead of app.listen(), so Apollo can drain it and ws can attach to it.
  const httpServer = http.createServer(app);

  const apollo = new ApolloServer({
    schema,
    // On apollo.stop(): stop accepting connections, wait for in-flight requests, close the server.
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });
  // Must finish before expressMiddleware() is mounted.
  await apollo.start();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // express.json() parses the POST body into req.body, which Apollo reads the operation from.
  app.use('/graphql', express.json(), expressMiddleware(apollo));

  return {
    httpServer,
    stop: () => apollo.stop(),
  };
}
