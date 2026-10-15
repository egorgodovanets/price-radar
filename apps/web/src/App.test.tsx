import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import type { ProductDetails, ProductSummary } from './api/operations';
import { CHAT_ID_STORAGE_KEY } from './features/watches/CreateWatchForm';
import { formatMoney } from './shared/format';
import { installFakeBff } from './test/fakeFetch';

/**
 * Price as Testing Library sees it: it turns the non-breaking spaces
 * that Intl puts into "1 400,00 ₴" into ordinary ones.
 */
function shownPrice(amount: number): string {
  return formatMoney({ amount, currency: 'UAH' }).replace(/\s/g, ' ');
}

function yogaMat(): ProductDetails {
  return {
    id: 'p1',
    title: 'Yoga mat',
    url: 'https://troli.shop/ua/yoga-mat',
    category: 'sport',
    attributes: [{ name: 'color', value: 'blue' }],
    currentPrice: { amount: 1400, currency: 'UAH' },
    priceUpdatedAt: '2026-10-02T10:00:00.000Z',
    createdAt: '2026-09-30T10:00:00.000Z',
    priceHistory: [
      { id: 'h2', price: { amount: 1400, currency: 'UAH' }, observedAt: '2026-10-02T10:00:00.000Z' },
      { id: 'h1', price: { amount: 1500, currency: 'UAH' }, observedAt: '2026-10-01T10:00:00.000Z' },
    ],
    watches: [
      { id: 'w1', chatId: '123', targetPrice: { amount: 1200, currency: 'UAH' }, createdAt: '2026-10-01T11:00:00.000Z' },
    ],
  };
}

function toSummary({ id, title, url, category, currentPrice, priceUpdatedAt }: ProductDetails): ProductSummary {
  return { id, title, url, category, currentPrice, priceUpdatedAt };
}

/** Fake BFF backed by an in-memory product list, so mutations are visible on refetch. */
function setUpBff(products: ProductDetails[] = [yogaMat()]) {
  const find = (id: unknown) => products.find((product) => product.id === id) ?? null;

  return installFakeBff({
    Products: () => ({ data: { products: products.map(toSummary) } }),
    Product: ({ id }) => ({ data: { product: find(id) } }),
    AddProduct: ({ input }) => {
      const { title, url, category, attributes } = input as Pick<
        ProductDetails,
        'title' | 'url' | 'category' | 'attributes'
      >;
      if (products.some((product) => product.url === url)) {
        return { data: null, errors: [{ message: `Product with url "${url}" already exists`, extensions: { code: 'CONFLICT' } }] };
      }
      const id = `p${products.length + 1}`;
      products.push({
        id,
        title,
        url,
        category,
        attributes,
        currentPrice: null,
        priceUpdatedAt: null,
        createdAt: '2026-10-03T10:00:00.000Z',
        priceHistory: [],
        watches: [],
      });
      return { data: { addProduct: { id } } };
    },
    RecordPrice: ({ productId, price }) => {
      const product = find(productId);
      if (!product) return { data: null, errors: [{ message: 'Product not found', extensions: { code: 'NOT_FOUND' } }] };
      const point = { id: `h${Date.now()}`, price: price as ProductDetails['priceHistory'][number]['price'], observedAt: '2026-10-03T10:00:00.000Z' };
      product.priceHistory.unshift(point);
      product.currentPrice = point.price;
      product.priceUpdatedAt = point.observedAt;
      return { data: { recordPrice: { id: point.id } } };
    },
    CreateWatch: ({ input }) => {
      const { productId, chatId, targetPrice } = input as {
        productId: string;
        chatId: string;
        targetPrice: ProductDetails['watches'][number]['targetPrice'];
      };
      const watch = { id: `w${chatId}`, chatId, targetPrice, createdAt: '2026-10-03T10:00:00.000Z' };
      find(productId)?.watches.push(watch);
      return { data: { createWatch: { id: watch.id } } };
    },
    DeleteWatch: ({ id }) => {
      for (const product of products) {
        const index = product.watches.findIndex((watch) => watch.id === id);
        if (index >= 0) {
          product.watches.splice(index, 1);
          return { data: { deleteWatch: true } };
        }
      }
      return { data: { deleteWatch: false } };
    },
  });
}

async function openYogaMat(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Yoga mat/ }));
  await screen.findByRole('heading', { name: 'Yoga mat' });
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('lists products and shows the selected product with history and watches', async () => {
    setUpBff();
    const user = userEvent.setup();
    render(<App />);

    const item = await screen.findByRole('button', { name: /Yoga mat/ });
    expect(within(item).getByText('troli.shop · sport')).toBeInTheDocument();
    expect(within(item).getByText(shownPrice(1400))).toBeInTheDocument();

    await openYogaMat(user);
    expect(screen.getByText('color: blue')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Price between/ })).toBeInTheDocument();
    // Header row plus two price points.
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText(/Chat 123/)).toBeInTheDocument();
  });

  it('adds a product with attributes, then shows and selects it', async () => {
    const { calls } = setUpBff();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: /Yoga mat/ });

    await user.type(screen.getByLabelText('Title'), 'Phone case');
    await user.type(screen.getByLabelText('Product page URL'), 'https://www.icover.lt/case');
    await user.selectOptions(screen.getByLabelText('Category'), 'electronics');
    await user.click(screen.getByRole('button', { name: '+ Add attribute' }));
    await user.type(screen.getByLabelText('Attribute name'), 'model');
    await user.type(screen.getByLabelText('Attribute value'), 'iPhone 15');
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByRole('heading', { name: 'Phone case' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phone case/ })).toHaveAttribute('aria-pressed', 'true');
    expect(calls.find((call) => call.operation === 'AddProduct')?.variables).toEqual({
      input: {
        title: 'Phone case',
        url: 'https://www.icover.lt/case',
        category: 'electronics',
        attributes: [{ name: 'model', value: 'iPhone 15' }],
      },
    });
  });

  it('checks the form before calling the BFF', async () => {
    const { calls } = setUpBff();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: /Yoga mat/ });

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title');
    expect(calls.some((call) => call.operation === 'AddProduct')).toBe(false);
  });

  it('shows the BFF message when the product already exists', async () => {
    setUpBff();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: /Yoga mat/ });

    await user.type(screen.getByLabelText('Title'), 'Yoga mat again');
    await user.type(screen.getByLabelText('Product page URL'), 'https://troli.shop/ua/yoga-mat');
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });

  it('records a price by hand and refreshes the product and the list', async () => {
    const { calls } = setUpBff();
    const user = userEvent.setup();
    render(<App />);
    await openYogaMat(user);

    await user.type(screen.getByLabelText('New price'), '1350');
    await user.click(screen.getByRole('button', { name: 'Record price' }));

    const item = screen.getByRole('button', { name: /Yoga mat/ });
    expect(await within(item).findByText(shownPrice(1350))).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(calls.find((call) => call.operation === 'RecordPrice')?.variables).toEqual({
      productId: 'p1',
      price: { amount: 1350, currency: 'UAH' },
    });
  });

  it('creates and deletes watches and remembers the chat id', async () => {
    const { calls } = setUpBff();
    const user = userEvent.setup();
    render(<App />);
    await openYogaMat(user);

    await user.type(screen.getByLabelText('Telegram chat id'), '555');
    await user.type(screen.getByLabelText('Target price'), '1300');
    await user.click(screen.getByRole('button', { name: 'Watch' }));

    expect(await screen.findByText(/Chat 555/)).toBeInTheDocument();
    expect(localStorage.getItem(CHAT_ID_STORAGE_KEY)).toBe('555');
    expect(calls.find((call) => call.operation === 'CreateWatch')?.variables).toEqual({
      input: { productId: 'p1', chatId: '555', targetPrice: { amount: 1300, currency: 'UAH' } },
    });

    await user.click(screen.getByRole('button', { name: 'Delete watch for chat 123' }));

    await waitFor(() => expect(screen.queryByText(/Chat 123/)).not.toBeInTheDocument());
    expect(screen.getByText(/Chat 555/)).toBeInTheDocument();
    expect(calls.find((call) => call.operation === 'DeleteWatch')?.variables).toEqual({ id: 'w1' });
  });

  it('shows a network error with Retry when the BFF is unreachable', async () => {
    const { network } = setUpBff();
    network.down = true;
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');

    network.down = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: /Yoga mat/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
