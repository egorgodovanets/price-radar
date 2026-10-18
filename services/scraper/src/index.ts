import { setTimeout as sleep } from 'node:timers/promises';
import { loadConfig } from './config.js';
import { fetchPage } from './fetchPage.js';
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
  log: console,
};

async function runOnce(signal: AbortSignal): Promise<void> {
  const startedAt = Date.now();
  const { changed, unchanged, skipped, failed } = await scrapeAll(deps, signal);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `Scrape finished in ${seconds}s: ${changed} changed, ${unchanged} unchanged, ${failed} failed, ${skipped} skipped`,
  );
}

// --once: a single pass, then exit. Handy by hand or from an external cron.
if (process.argv.includes('--once')) {
  await runOnce(new AbortController().signal);
} else {
  const scheduler = startScheduler(runOnce, config.intervalMs, (error) => {
    console.error('Scrape run failed', error);
  });
  console.log(`Scraper started: every ${config.intervalMs / 60_000} min, Tracker at ${config.trackerUrl}`);

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received, shutting down...`);
    // Aborts the page being loaded and waits for the run to settle; no half-written state to clean up.
    await scheduler.stop();
    console.log('Scraper stopped');
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      shutdown(signal).catch((error: unknown) => {
        console.error('Shutdown failed', error);
        process.exitCode = 1;
      });
    });
  }
}
