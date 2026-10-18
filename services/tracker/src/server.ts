import http from 'node:http';
import { MongoClient } from 'mongodb';
import { createApp } from './app.js';
import type { Config } from './config.js';
import { connectKafkaPriceEvents } from './events/kafkaPriceEvents.js';
import { disabledPriceEvents, type PriceEvents } from './events/priceEvents.js';
import { PriceRepository } from './prices/price.repository.js';
import { PriceService } from './prices/price.service.js';
import { ProductRepository } from './products/product.repository.js';
import { WatchRepository } from './watches/watch.repository.js';
import { WatchService } from './watches/watch.service.js';

export interface TrackerServer {
  httpServer: http.Server;
  /** Closes the HTTP server, then Kafka (sending what is buffered), then the MongoDB connection pool. */
  stop(): Promise<void>;
}

function closeHttpServer(server: http.Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/** Connects to MongoDB (and Kafka if configured) and assembles the HTTP server. Does not call listen(). */
export async function createServer(config: Config): Promise<TrackerServer> {
  const client = new MongoClient(config.mongoUrl, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();
  let events: PriceEvents = disabledPriceEvents;

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

    if (config.kafkaBrokers) events = await connectKafkaPriceEvents(config.kafkaBrokers);

    const watches = new WatchService({ products, watches: watchRepository });
    const prices = new PriceService({ products, prices: priceRepository, events });
    const httpServer = http.createServer(createApp({ products, watches, prices }));

    return {
      httpServer,
      async stop() {
        await closeHttpServer(httpServer);
        // After HTTP: no request can record a price anymore, so nothing new is published.
        await events.close();
        await client.close();
      },
    };
  } catch (error) {
    await events.close();
    await client.close();
    throw error;
  }
}
