import { setTimeout as sleep } from 'node:timers/promises';
import { loadConfig } from './config.js';
import { fetchPage } from './fetchPage.js';
import { logger } from './logger.js';
import { startScheduler } from './scheduler.js';
import { scrapeAll, type ScrapeDeps } from './scrape.js';
import { findShop } from './shops/index.js';
import { TrackerClient } from './tracker/trackerClient.js';

const config = loadConfig();

const deps: ScrapeDeps = {
  tracker: new TrackerClient(config.trackerUrl),
  findShop,
  fetchPage,
  pause: (signal) => sleep(config.requestDelayMs, undefined, { signal }),
  log: logger,
};

async function runOnce(signal: AbortSignal): Promise<void> {
  const startedAt = Date.now();
  const summary = await scrapeAll(deps, signal);
  logger.info({ ...summary, durationMs: Date.now() - startedAt }, 'Scrape finished');
}

// --once: a single pass, then exit. Handy by hand or from an external cron.
if (process.argv.includes('--once')) {
  await runOnce(new AbortController().signal);
} else {
  const scheduler = startScheduler(runOnce, config.intervalMs, (error) => {
    logger.error({ err: error }, 'Scrape run failed');
  });
  logger.info({ intervalMinutes: config.intervalMs / 60_000, tracker: config.trackerUrl }, 'Scraper started');

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Shutting down');
    // Aborts the page being loaded and waits for the run to settle; no half-written state to clean up.
    await scheduler.stop();
    logger.info('Scraper stopped');
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      shutdown(signal).catch((error: unknown) => {
        logger.error({ err: error }, 'Shutdown failed');
        process.exitCode = 1;
      });
    });
  }
}
