import { describe, expect, it, jest } from '@jest/globals';
import { scrapeAll, type ScrapeDeps } from './scrape.js';
import { findShop } from './shops/index.js';
import type { TrackedProduct } from './tracker/trackerClient.js';

const microdata = (price: number) =>
  `<meta itemprop="priceCurrency" content="UAH"><meta itemprop="price" content="${price}">`;

const chalk: TrackedProduct = {
  id: 'p1',
  title: 'Chalk',
  url: 'https://troli.shop/ua/chalk_block/',
  currentPrice: { amount: 110, currency: 'UAH' },
};
const belt: TrackedProduct = {
  id: 'p2',
  title: 'Belt',
  url: 'https://troli.shop/ua/belt_cobra/',
  currentPrice: { amount: 178, currency: 'UAH' },
};
const unknownShop: TrackedProduct = { id: 'p3', title: 'Kettle', url: 'https://example.com/kettle', currentPrice: null };

/** Fake Tracker and fake shop pages: url -> HTML, or an Error to throw. */
function setup(products: TrackedProduct[], pages: Record<string, string | Error>) {
  const deps = {
    tracker: {
      listProducts: jest.fn<ScrapeDeps['tracker']['listProducts']>().mockResolvedValue(products),
      recordPrice: jest.fn<ScrapeDeps['tracker']['recordPrice']>().mockResolvedValue(undefined),
    },
    findShop,
    fetchPage: jest.fn<ScrapeDeps['fetchPage']>((url) => {
      const page = pages[url];
      return page instanceof Error || page === undefined ? Promise.reject(page ?? new Error('404')) : Promise.resolve(page);
    }),
    pause: jest.fn<ScrapeDeps['pause']>().mockResolvedValue(undefined),
    log: { info: jest.fn(), warn: jest.fn() },
  };
  return deps;
}

describe('scrapeAll', () => {
  it('sends only changed prices to Tracker', async () => {
    const deps = setup([chalk, belt], { [chalk.url]: microdata(105), [belt.url]: microdata(178) });

    const summary = await scrapeAll(deps, new AbortController().signal);

    expect(summary).toEqual({ changed: 1, unchanged: 1, skipped: 0, failed: 0 });
    expect(deps.tracker.recordPrice).toHaveBeenCalledTimes(1);
    expect(deps.tracker.recordPrice).toHaveBeenCalledWith('p1', { amount: 105, currency: 'UAH' });
  });

  it('sends the first price of a product that has none', async () => {
    const fresh = { ...chalk, currentPrice: null };
    const deps = setup([fresh], { [chalk.url]: microdata(105) });

    await expect(scrapeAll(deps, new AbortController().signal)).resolves.toMatchObject({ changed: 1 });
  });

  it('skips unsupported shops without loading them', async () => {
    const deps = setup([unknownShop], {});

    await expect(scrapeAll(deps, new AbortController().signal)).resolves.toMatchObject({ skipped: 1 });
    expect(deps.fetchPage).not.toHaveBeenCalled();
  });

  it('keeps going when one product fails', async () => {
    const deps = setup([chalk, belt], { [chalk.url]: new Error('timeout'), [belt.url]: microdata(170) });

    const summary = await scrapeAll(deps, new AbortController().signal);

    expect(summary).toEqual({ changed: 1, unchanged: 0, skipped: 0, failed: 1 });
    expect(deps.log.warn).toHaveBeenCalledWith(
      { err: new Error('timeout'), productId: 'p1', url: chalk.url },
      'Could not check a product',
    );
  });

  it('counts a Tracker refusal as a failure of that product', async () => {
    const deps = setup([chalk], { [chalk.url]: microdata(105) });
    deps.tracker.recordPrice.mockRejectedValue(new Error('Tracker POST failed with 422'));

    await expect(scrapeAll(deps, new AbortController().signal)).resolves.toMatchObject({ failed: 1 });
  });

  it('pauses between two pages, not before the first one', async () => {
    const deps = setup([chalk, unknownShop, belt], { [chalk.url]: microdata(110), [belt.url]: microdata(178) });

    await scrapeAll(deps, new AbortController().signal);

    expect(deps.pause).toHaveBeenCalledTimes(1);
  });

  it('stops at once when aborted', async () => {
    const controller = new AbortController();
    const deps = setup([chalk, belt], { [chalk.url]: microdata(105), [belt.url]: microdata(170) });
    deps.fetchPage.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new Error('aborted'));
    });

    await expect(scrapeAll(deps, controller.signal)).rejects.toThrow('aborted');
    expect(deps.fetchPage).toHaveBeenCalledTimes(1);
    expect(deps.tracker.recordPrice).not.toHaveBeenCalled();
  });
});
