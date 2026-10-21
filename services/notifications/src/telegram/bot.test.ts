import { describe, expect, it, jest } from '@jest/globals';
import { replyTo, startBot } from './bot.js';
import type { TelegramUpdate } from './telegramClient.js';

const chat = { id: 42 };

describe('replyTo', () => {
  it.each(['/start', '/id', '  /start  ', '/start@PriceRadarBot'])('answers %p with the chat id', (text) => {
    expect(replyTo({ chat, text })).toContain('Your chat id: 42');
  });

  it('points to /start on any other text', () => {
    expect(replyTo({ chat, text: 'hello' })).toBe('Send /start to get your chat id.');
  });

  it('stays silent on messages without text (stickers, photos)', () => {
    expect(replyTo({ chat })).toBeNull();
  });
});

describe('startBot', () => {
  /** Returns the batches one by one, then waits like a real long poll until aborted. */
  function fakeTelegram(batches: (TelegramUpdate[] | Error)[]) {
    let drained!: () => void;
    const allRead = new Promise<void>((resolve) => (drained = resolve));
    const telegram = {
      getUpdates: jest.fn((_offset: number | undefined, timeout: number, signal: AbortSignal) => {
        const batch = batches.shift();
        if (batch instanceof Error) return Promise.reject(batch);
        if (batch) return Promise.resolve(batch);
        if (timeout === 0) return Promise.resolve([]);
        drained();
        return new Promise<TelegramUpdate[]>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      }),
      sendMessage: jest.fn((_chatId: string, _text: string) => Promise.resolve()),
    };
    return { telegram, allRead };
  }

  const options = { pollTimeoutSeconds: 30, retryDelayMs: 0 };

  it('replies to each message and moves the offset past handled updates', async () => {
    const { telegram, allRead } = fakeTelegram([
      [{ update_id: 10, message: { chat, text: '/start' } }],
      [{ update_id: 11 }, { update_id: 12, message: { chat: { id: 7 }, text: 'hi' } }],
    ]);

    const bot = startBot(telegram, { error: jest.fn() }, options);
    await allRead;
    await bot.stop();

    expect(telegram.sendMessage.mock.calls.map(([chatId]) => chatId)).toEqual(['42', '7']);
    const offsets = telegram.getUpdates.mock.calls.map(([offset]) => offset);
    // First poll, after 10, after 12 (waits), and the final confirm with timeout 0.
    expect(offsets).toEqual([undefined, 11, 13, 13]);
    expect(telegram.getUpdates.mock.calls.at(-1)?.[1]).toBe(0);
  });

  it('logs a failed poll or reply and keeps going', async () => {
    const { telegram, allRead } = fakeTelegram([new Error('network'), [{ update_id: 1, message: { chat, text: '/id' } }]]);
    telegram.sendMessage.mockRejectedValueOnce(new Error('blocked'));
    const log = { error: jest.fn() };

    const bot = startBot(telegram, log, options);
    await allRead;
    await bot.stop();

    expect(log.error).toHaveBeenCalledWith('Telegram getUpdates failed', new Error('network'));
    expect(log.error).toHaveBeenCalledWith('Telegram reply failed', new Error('blocked'));
  });
});
