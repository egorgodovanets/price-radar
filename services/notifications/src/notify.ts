import { parsePriceChangedMessage, type PriceChangedEvent } from './events/priceChanged.js';
import type { Logger } from './logger.js';
import type { Money } from './money.js';
import { withRetry } from './retry.js';
import type { TelegramClient } from './telegram/telegramClient.js';
import { TrackerError, type TrackedProduct, type TrackerClient } from './tracker/trackerClient.js';

export interface NotifyDeps {
  tracker: Pick<TrackerClient, 'listWatches' | 'getProduct'>;
  telegram: Pick<TelegramClient, 'sendMessage'>;
  log: Pick<Logger, 'info' | 'warn' | 'error'>;
  /** First pause between retries when Tracker fails; tests pass 0. */
  retryDelayMs?: number;
}

const RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

function atOrBelow(price: Money, target: Money): boolean {
  return price.currency === target.currency && price.amount <= target.amount;
}

/**
 * True when the price has just crossed the target: it is at or below it now, but was above
 * it before. The user hears about it once, not again on every further drop.
 */
export function reachedTarget(event: PriceChangedEvent, target: Money): boolean {
  if (!atOrBelow(event.price, target)) return false;
  return !(event.previousPrice && atOrBelow(event.previousPrice, target));
}

function formatMoney({ amount, currency }: Money): string {
  return `${amount} ${currency}`;
}

/** Plain text (no Markdown/HTML), so a product title never needs escaping. */
export function formatAlert(product: TrackedProduct, event: PriceChangedEvent, target: Money): string {
  const change = event.previousPrice
    ? `${formatMoney(event.previousPrice)} → ${formatMoney(event.price)}`
    : `Now ${formatMoney(event.price)}`;
  return [`Price drop: ${product.title}`, `${change} (your target: ${formatMoney(target)})`, product.url].join('\n');
}

/**
 * Messages every chat whose target was just reached; returns how many alerts were sent.
 * Tracker errors throw (nothing is sent yet, so a retry is safe); a failed send to one chat
 * is only logged, so the other chats still get theirs.
 */
export async function notifyWatchers(event: PriceChangedEvent, deps: NotifyDeps): Promise<number> {
  const watches = await deps.tracker.listWatches(event.productId);
  const reached = watches.filter((watch) => reachedTarget(event, watch.targetPrice));
  // Most price changes reach nobody: then the product is not even loaded.
  if (reached.length === 0) return 0;

  const product = await deps.tracker.getProduct(event.productId);
  let sent = 0;
  for (const watch of reached) {
    try {
      await deps.telegram.sendMessage(watch.chatId, formatAlert(product, event, watch.targetPrice));
      sent++;
    } catch (error) {
      // E.g. 403: the user blocked the bot. Retrying would not help.
      deps.log.error({ err: error, chatId: watch.chatId, productId: event.productId }, 'Alert failed');
    }
  }
  return sent;
}

/** 4xx from Tracker (e.g. the product was deleted) will not get better with a retry; 5xx and network errors may. */
function isRetryable(error: unknown): boolean {
  return !(error instanceof TrackerError && error.status < 500);
}

/**
 * One Kafka message. Malformed messages and failures that outlive the retries are logged
 * and skipped (the caller then commits). Throws only when interrupted by shutdown.
 */
export async function handlePriceChangedMessage(
  value: Buffer | null | undefined,
  deps: NotifyDeps,
  signal: AbortSignal,
): Promise<void> {
  const event = parsePriceChangedMessage(value);
  if (!event) {
    deps.log.warn({ raw: value?.toString('utf8') }, 'Skipping a malformed price.changed message');
    return;
  }

  try {
    const sent = await withRetry(() => notifyWatchers(event, deps), {
      attempts: RETRY_ATTEMPTS,
      delayMs: deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      isRetryable,
      signal,
    });
    if (sent > 0) deps.log.info({ productId: event.productId, sent }, 'Alerts sent');
  } catch (error) {
    if (signal.aborted) throw error;
    deps.log.error({ err: error, productId: event.productId }, 'Giving up on a price change');
  }
}
