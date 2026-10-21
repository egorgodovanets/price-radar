import { describe, expect, it, jest } from '@jest/globals';
import type { PriceChangedEvent } from './events/priceChanged.js';
import type { Money } from './money.js';
import { formatAlert, handlePriceChangedMessage, notifyWatchers, reachedTarget, type NotifyDeps } from './notify.js';
import { TrackerError, type TrackedProduct, type Watch } from './tracker/trackerClient.js';

const uah = (amount: number): Money => ({ amount, currency: 'UAH' });

const event = (amount: number, previous: number | null): PriceChangedEvent => ({
  productId: 'p1',
  price: uah(amount),
  previousPrice: previous === null ? null : uah(previous),
  observedAt: '2026-10-13T10:00:00.000Z',
});

const product: TrackedProduct = { id: 'p1', title: 'Chalk block', url: 'https://troli.shop/ua/chalk_block/' };

const watch = (chatId: string, target: Money): Watch => ({ id: `w${chatId}`, productId: 'p1', chatId, targetPrice: target });

function makeDeps(watches: Watch[]) {
  return {
    tracker: {
      listWatches: jest.fn((_productId: string) => Promise.resolve(watches)),
      getProduct: jest.fn((_id: string) => Promise.resolve(product)),
    },
    telegram: { sendMessage: jest.fn((_chatId: string, _text: string) => Promise.resolve()) },
    log: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    retryDelayMs: 0,
  } satisfies NotifyDeps;
}

describe('reachedTarget', () => {
  it.each([
    ['drops below the target', 95, 105, true],
    ['drops exactly to the target', 100, 105, true],
    ['first price is already below the target', 95, null, true],
    ['stays above the target', 102, 105, false],
    ['was already below and drops further', 90, 95, false],
    ['rises back above the target', 105, 95, false],
  ])('%s', (_name, amount, previous, expected) => {
    expect(reachedTarget(event(amount, previous), uah(100))).toBe(expected);
  });

  it('never matches a target in another currency', () => {
    expect(reachedTarget(event(1, 105), { amount: 100, currency: 'EUR' })).toBe(false);
  });
});

describe('formatAlert', () => {
  it('shows the old and new price, the target and the link', () => {
    expect(formatAlert(product, event(95, 105), uah(100))).toBe(
      'Price drop: Chalk block\n105 UAH → 95 UAH (your target: 100 UAH)\nhttps://troli.shop/ua/chalk_block/',
    );
  });

  it('has no "old" price for the first observation', () => {
    expect(formatAlert(product, event(95, null), uah(100))).toContain('Now 95 UAH (your target: 100 UAH)');
  });
});

describe('notifyWatchers', () => {
  it('messages only the chats whose target was just reached', async () => {
    const deps = makeDeps([watch('1', uah(100)), watch('2', uah(90)), watch('3', uah(99))]);

    await expect(notifyWatchers(event(95, 105), deps)).resolves.toBe(2);
    expect(deps.telegram.sendMessage.mock.calls.map(([chatId]) => chatId)).toEqual(['1', '3']);
    expect(deps.tracker.listWatches).toHaveBeenCalledWith('p1');
  });

  it('does not load the product when nobody is notified', async () => {
    const deps = makeDeps([watch('1', uah(50))]);

    await expect(notifyWatchers(event(95, 105), deps)).resolves.toBe(0);
    expect(deps.tracker.getProduct).not.toHaveBeenCalled();
  });

  it('keeps sending to other chats when one send fails', async () => {
    const deps = makeDeps([watch('1', uah(100)), watch('2', uah(100))]);
    deps.telegram.sendMessage.mockRejectedValueOnce(new Error('bot was blocked'));

    await expect(notifyWatchers(event(95, 105), deps)).resolves.toBe(1);
    expect(deps.log.error).toHaveBeenCalledWith('Alert to chat 1 failed', new Error('bot was blocked'));
  });
});

describe('handlePriceChangedMessage', () => {
  const message = (value: unknown) => Buffer.from(JSON.stringify(value));
  const signal = new AbortController().signal;

  it('notifies for a valid message', async () => {
    const deps = makeDeps([watch('1', uah(100))]);

    await handlePriceChangedMessage(message(event(95, 105)), deps, signal);

    expect(deps.telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(deps.log.log).toHaveBeenCalledWith('Sent 1 alert(s) for product p1');
  });

  it('skips a malformed message with a warning', async () => {
    const deps = makeDeps([]);

    await handlePriceChangedMessage(Buffer.from('{oops'), deps, signal);

    expect(deps.log.warn).toHaveBeenCalled();
    expect(deps.tracker.listWatches).not.toHaveBeenCalled();
  });

  it('retries when Tracker is down and succeeds later', async () => {
    const deps = makeDeps([watch('1', uah(100))]);
    deps.tracker.listWatches.mockRejectedValueOnce(new TrackerError(503, 'unavailable'));

    await handlePriceChangedMessage(message(event(95, 105)), deps, signal);

    expect(deps.tracker.listWatches).toHaveBeenCalledTimes(2);
    expect(deps.telegram.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('gives up at once on a 4xx from Tracker and logs it', async () => {
    const deps = makeDeps([watch('1', uah(100))]);
    deps.tracker.getProduct.mockRejectedValue(new TrackerError(404, 'Product not found'));

    await handlePriceChangedMessage(message(event(95, 105)), deps, signal);

    expect(deps.tracker.getProduct).toHaveBeenCalledTimes(1);
    expect(deps.log.error).toHaveBeenCalledWith('Giving up on the price change of product p1', expect.any(TrackerError));
  });
});
