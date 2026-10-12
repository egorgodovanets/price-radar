import http from 'node:http';
import { MongoClient } from 'mongodb';
import { createApp } from './app.js';
import type { Config } from './config.js';
import { PriceRepository } from './prices/price.repository.js';
import { PriceService } from './prices/price.service.js';
import { ProductRepository } from './products/product.repository.js';
import { WatchRepository } from './watches/watch.repository.js';
import { WatchService } from './watches/watch.service.js';

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
    const watchRepository = new WatchRepository(db);
    const priceRepository = new PriceRepository(db);
    await Promise.all([
      products.ensureIndexes(),
      watchRepository.ensureIndexes(),
      priceRepository.ensureIndexes(),
    ]);

    const watches = new WatchService({ products, watches: watchRepository });
    const prices = new PriceService({ products, prices: priceRepository });
    const httpServer = http.createServer(createApp({ products, watches, prices }));

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
