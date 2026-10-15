import { describe, expect, it } from '@jest/globals';
import { formatMoney, isHttpUrl, parseAmount, shopName } from './format';

describe('format helpers', () => {
  it('formats money in the Ukrainian locale', () => {
    // \s also matches the non-breaking spaces Intl puts between groups.
    expect(formatMoney({ amount: 1500, currency: 'UAH' })).toMatch(/^1\s500,00\s₴$/);
    expect(formatMoney({ amount: 12.5, currency: 'EUR' })).toMatch(/^12,50\s€$/);
  });

  it('shows the shop host without www', () => {
    expect(shopName('https://www.icover.lt/case')).toBe('icover.lt');
    expect(shopName('https://troli.shop/ua/mat')).toBe('troli.shop');
    expect(shopName('not a url')).toBe('not a url');
  });

  it('accepts only http(s) URLs', () => {
    expect(isHttpUrl('https://troli.shop/ua')).toBe(true);
    expect(isHttpUrl('ftp://troli.shop')).toBe(false);
    expect(isHttpUrl('troli.shop')).toBe(false);
  });

  it.each([
    ['1500', 1500],
    ['12,99', 12.99],
    [' 7.5 ', 7.5],
  ])('parses amount %p', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each(['', '0', '-3', 'abc'])('rejects amount %p', (raw) => {
    expect(parseAmount(raw)).toBeUndefined();
  });
});
