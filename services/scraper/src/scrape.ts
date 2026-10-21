import type { Logger } from './logger.js';
import type { Money } from './money.js';
import type { Shop } from './shops/shop.js';
import type { TrackedProduct, TrackerClient } from './tracker/trackerClient.js';

export interface ScrapeDeps {
  tracker: Pick<TrackerClient, 'listProducts' | 'recordPrice'>;
  findShop: (url: string) => Shop | undefined;
  fetchPage: (url: string, signal: AbortSignal) => Promise<string>;
  /** Waits between two shop pages; tests pass a function that resolves at once. */
  pause: (signal: AbortSignal) => Promise<void>;
  log: Pick<Logger, 'info' | 'warn'>;
}

export interface ScrapeSummary {
  /** A new price was sent to Tracker. */
  changed: number;
  /** The page shows the price Tracker already has. */
  unchanged: number;
  /** No adapter for this shop. */
  skipped: number;
  /** The page or Tracker failed; the next run tries again. */
  failed: number;
}

function samePrice(a: Money | null, b: Money): boolean {
  return a !== null && a.amount === b.amount && a.currency === b.currency;
}

/**
 * One pass over every tracked product: read the shop page, send the price to Tracker if it changed.
 * Pages are read one by one with a pause, so a shop never gets a burst of requests from us.
 * A failing product is logged and skipped; it must not stop the others.
 */
export async function scrapeAll(deps: ScrapeDeps, signal: AbortSignal): Promise<ScrapeSummary> {
  const summary: ScrapeSummary = { changed: 0, unchanged: 0, skipped: 0, failed: 0 };
  const products = await deps.tracker.listProducts();
  let pagesRead = 0;

  for (const product of products) {
    signal.throwIfAborted();

    const shop = deps.findShop(product.url);
    if (!shop) {
      summary.skipped += 1;
      continue;
    }

    if (pagesRead > 0) await deps.pause(signal);
    pagesRead += 1;

    try {
      summary[await checkProduct(deps, shop, product, signal)] += 1;
    } catch (error) {
      // Shutdown is not a failure of this product: stop the whole run.
      if (signal.aborted) throw error;
      summary.failed += 1;
      deps.log.warn({ err: error, productId: product.id, url: product.url }, 'Could not check a product');
    }
  }
  return summary;
}

async function checkProduct(
  deps: ScrapeDeps,
  shop: Shop,
  product: TrackedProduct,
  signal: AbortSignal,
): Promise<'changed' | 'unchanged'> {
  const price = shop.readPrice(await deps.fetchPage(product.url, signal));
  // The history stores changes only; an unchanged price is not sent at all.
  if (samePrice(product.currentPrice, price)) return 'unchanged';

  await deps.tracker.recordPrice(product.id, price);
  deps.log.info(
    { productId: product.id, title: product.title, from: product.currentPrice?.amount ?? null, to: price.amount, currency: price.currency },
    'Price changed',
  );
  return 'changed';
}
