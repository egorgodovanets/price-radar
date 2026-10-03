import http from 'node:http';
import { MongoClient } from 'mongodb';
import { createApp } from './app.js';
import type { Config } from './config.js';
import { ProductRepository } from './products/product.repository.js';

export interface TrackerServer {
  httpServer: http.Server;
  /** Closes the HTTP server, then the MongoDB connection pool. */
  stop(): Promise<void>;
}

function closeHttpServer(server: http.Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/** Connects to MongoDB and assembles the HTTP server. Does not call listen(). */
export async function createServer(config: Config): Promise<TrackerServer> {
  const client = new MongoClient(config.mongoUrl, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();

  try {
    const db = client.db(config.mongoDb);
    const products = new ProductRepository(db);
    await products.ensureIndexes();

    const httpServer = http.createServer(createApp({ products }));

    return {
      httpServer,
      async stop() {
        await closeHttpServer(httpServer);
        await client.close();
      },
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}