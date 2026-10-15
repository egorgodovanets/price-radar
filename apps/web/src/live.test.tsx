import { afterEach, describe, expect, it } from '@jest/globals';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import type { Money, ProductDetails, ProductSummary } from './api/operations';
import { LiveTransportContext } from './api/useSubscription';
import { formatMoney } from './shared/format';
import { installFakeBff } from './test/fakeFetch';
import { createFakeLiveTransport } from './test/fakeLiveTransport';

/** formatMoney output as Testing Library sees it (non-breaking spaces become ordinary ones). */
function shownPrice(amount: number): string {
  return formatMoney({ amount, currency: 'UAH' }).replace(/\s/g, ' ');
}

function product(id: string, title: string, amount: number): ProductDetails {
  const price: Money = { amount, currency: 'UAH' };
  return {
    id,
    title,
    url: `https://troli.shop/ua/${id}`,
    category: 'sport',
    attributes: [],
    currentPrice: price,
    priceUpdatedAt: '2026-10-02T10:00:00.000Z',
    createdAt: '2026-09-30T10:00:00.000Z',
    priceHistory: [{ id: `${id}-h1`, price, observedAt: '2026-10-02T10:00:00.000Z' }],
    watches: [],
  };
}

function toSummary({ id, title, url, category, currentPrice, priceUpdatedAt }: ProductDetails): ProductSummary {
  return { id, title, url, category, currentPrice, priceUpdatedAt };
}

/** Changes the price in the fake BFF, as the scraper would, and returns the matching event. */
function changePrice(target: ProductDetails, amount: number) {
  const previousPrice = target.currentPrice;
  const price: Money = { amount, currency: 'UAH' };
  const observedAt = '2026-10-03T10:00:00.000Z';
  target.priceHistory.unshift({ id: `${target.id}-h${amount}`, price, observedAt });
  target.currentPrice = price;
  target.priceUpdatedAt = observedAt;
  return { priceChanged: { productId: target.id, price, previousPrice, observedAt } };
}

function setUp() {
  const mat = product('p1', 'Yoga mat', 1400);
  const ball = product('p2', 'Fitness ball', 800);
  const products = [mat, ball];
  const bff = installFakeBff({
    Products: () => ({ data: { products: products.map(toSummary) } }),
    Product: ({ id }) => ({ data: { product: products.find((item) => item.id === id) ?? null } }),
  });
  const live = createFakeLiveTransport();

  render(
    <LiveTransportContext value={live.transport}>
      <App />
    </LiveTransportContext>,
  );
  return { mat, ball, bff, live, user: userEvent.setup() };
}

const count = (calls: { operation: string }[], operation: string) =>
  calls.filter((call) => call.operation === operation).length;

describe('live price updates', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('updates the list and the open product without a reload', async () => {
    const { mat, live, user } = setUp();
    await user.click(await screen.findByRole('button', { name: /Yoga mat/ }));
    await screen.findByRole('heading', { name: 'Yoga mat' });

    act(() => live.emit(changePrice(mat, 1250)));

    const item = screen.getByRole('button', { name: /Yoga mat/ });
    expect(await within(item).findByText(shownPrice(1250))).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(
      `Live: price changed from ${shownPrice(1400)} to ${shownPrice(1250)}`,
    );
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
  });

  it('a change of another product refreshes only the list', async () => {
    const { ball, bff, live, user } = setUp();
    await user.click(await screen.findByRole('button', { name: /Yoga mat/ }));
    await screen.findByRole('heading', { name: 'Yoga mat' });
    const productRequests = count(bff.calls, 'Product');

    act(() => live.emit(changePrice(ball, 750)));

    const item = screen.getByRole('button', { name: /Fitness ball/ });
    expect(await within(item).findByText(shownPrice(750))).toBeInTheDocument();
    expect(count(bff.calls, 'Product')).toBe(productRequests);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('subscribes to all products plus the open one, and moves the second subscription on switch', async () => {
    const { live, user } = setUp();
    await screen.findByRole('button', { name: /Yoga mat/ });
    expect(live.active()).toEqual([{}]);

    await user.click(screen.getByRole('button', { name: /Yoga mat/ }));
    expect(live.active()).toEqual([{}, { productId: 'p1' }]);

    await user.click(screen.getByRole('button', { name: /Fitness ball/ }));
    expect(live.active()).toEqual([{}, { productId: 'p2' }]);
  });

  it('reloads data after a reconnect, because events sent while offline are lost', async () => {
    const { bff, live, user } = setUp();
    await user.click(await screen.findByRole('button', { name: /Yoga mat/ }));
    await screen.findByRole('heading', { name: 'Yoga mat' });
    const before = { list: count(bff.calls, 'Products'), product: count(bff.calls, 'Product') };

    act(() => live.reconnect());

    await waitFor(() => {
      expect(count(bff.calls, 'Products')).toBe(before.list + 1);
      expect(count(bff.calls, 'Product')).toBe(before.product + 1);
    });
  });
});
