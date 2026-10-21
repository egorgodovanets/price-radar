import { describe, expect, it } from '@jest/globals';
import { parsePriceChangedMessage } from './priceChanged.js';

const event = {
  productId: '6acde6ff2265dca98474eb28',
  price: { amount: 95, currency: 'UAH' },
  previousPrice: { amount: 105, currency: 'UAH' },
  observedAt: '2026-10-13T10:00:00.000Z',
};

const message = (value: unknown) => Buffer.from(JSON.stringify(value));

describe('parsePriceChangedMessage', () => {
  it('parses a valid event', () => {
    expect(parsePriceChangedMessage(message(event))).toEqual(event);
  });

  it('accepts the first price of a product (previousPrice null)', () => {
    expect(parsePriceChangedMessage(message({ ...event, previousPrice: null }))).toMatchObject({ previousPrice: null });
  });

  it.each([
    ['an empty message', null],
    ['not JSON', Buffer.from('{oops')],
    ['an array', message([event])],
    ['a missing productId', message({ ...event, productId: undefined })],
    ['an unknown currency', message({ ...event, price: { amount: 1, currency: 'USD' } })],
    ['a non-finite amount', Buffer.from(JSON.stringify(event).replace('95', '1e999'))],
    ['a broken previousPrice', message({ ...event, previousPrice: { amount: '105' } })],
  ])('rejects %s', (_name, value) => {
    expect(parsePriceChangedMessage(value)).toBeNull();
  });
});
