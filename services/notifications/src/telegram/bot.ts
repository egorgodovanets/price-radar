import { setTimeout as sleep } from 'node:timers/promises';
import type { Logger } from '../logger.js';
import type { TelegramClient, TelegramMessage } from './telegramClient.js';

type Log = Pick<Logger, 'error'>;

/** What the bot answers to a message, or null to stay silent. */
export function replyTo(message: TelegramMessage): string | null {
  if (!message.text) return null;

  // In group chats commands look like "/start@PriceRadarBot".
  const command = message.text.trim().split(/[\s@]/)[0];
  if (command === '/start' || command === '/id') {
    return [
      `Your chat id: ${message.chat.id}`,
      '',
      'Use it when you create a watch in Price Radar. I will message you here when the price drops to your target.',
    ].join('\n');
  }
  return 'Send /start to get your chat id.';
}

export interface Bot {
  stop(): Promise<void>;
}

export interface BotOptions {
  pollTimeoutSeconds: number;
  retryDelayMs: number;
}

const DEFAULT_OPTIONS: BotOptions = { pollTimeoutSeconds: 30, retryDelayMs: 5000 };

/**
 * Answers incoming messages via long polling (getUpdates), so the bot needs no public URL.
 * Only one process per bot token may poll: Telegram answers a second one with 409 Conflict.
 */
export function startBot(
  telegram: Pick<TelegramClient, 'getUpdates' | 'sendMessage'>,
  log: Log,
  options: BotOptions = DEFAULT_OPTIONS,
): Bot {
  const controller = new AbortController();
  const { signal } = controller;
  let offset: number | undefined;

  const done = (async () => {
    while (!signal.aborted) {
      let updates;
      try {
        updates = await telegram.getUpdates(offset, options.pollTimeoutSeconds, signal);
      } catch (error) {
        if (signal.aborted) break;
        log.error({ err: error }, 'Telegram getUpdates failed');
        await sleep(options.retryDelayMs, undefined, { signal }).catch(() => undefined);
        continue;
      }

      for (const update of updates) {
        offset = update.update_id + 1;
        const reply = update.message ? replyTo(update.message) : null;
        if (!update.message || !reply) continue;

        try {
          await telegram.sendMessage(String(update.message.chat.id), reply);
        } catch (error) {
          log.error({ err: error, chatId: update.message.chat.id }, 'Telegram reply failed');
        }
      }
    }

    // Confirm the last handled updates; otherwise Telegram returns them again after a restart.
    if (offset !== undefined) {
      await telegram.getUpdates(offset, 0, new AbortController().signal).catch(() => undefined);
    }
  })();

  return {
    async stop() {
      controller.abort();
      await done;
    },
  };
}
