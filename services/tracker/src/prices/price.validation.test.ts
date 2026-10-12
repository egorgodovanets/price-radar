import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  parseHistoryLimit,
  validateRecordPrice,
} from './price.validation.js';

describe('validateRecordPrice', () => {
  it('accepts money and drops unknown fields', () => {
    expect(validateRecordPrice({ amount: 1499.5, currency: 'UAH', isAdmin: true })).toEqual({
      ok: true,
      value: { amount: 1499.5, currency: 'UAH' },
    });
  });

  it.each([
    ['a string body', 'cheap'],
    ['a zero amount', { amount: 0, currency: 'UAH' }],
    ['an amount sent as a string', { amount: '100', currency: 'UAH' }],
    ['an unknown currency', { amount: 100, currency: 'USD' }],
  ])('rejects %s', (_case, body) => {
    expect(validateRecordPrice(body).ok).toBe(false);
  });
});

describe('parseHistoryLimit', () => {
  it('falls back to the default when limit is missing', () => {
    expect(parseHistoryLimit(undefined)).toEqual({ ok: true, value: DEFAULT_HISTORY_LIMIT });
  });

  it('turns the query string into a number', () => {
    expect(parseHistoryLimit('5')).toEqual({ ok: true, value: 5 });
  });

  it.each(['0', '-1', '2.5', 'abc', '', String(MAX_HISTORY_LIMIT + 1)])('rejects "%s"', (raw) => {
    expect(parseHistoryLimit(raw).ok).toBe(false);
  });

  it('rejects a repeated key (?limit=5&limit=10 arrives as an array)', () => {
    expect(parseHistoryLimit(['5', '10']).ok).toBe(false);
  });
});
