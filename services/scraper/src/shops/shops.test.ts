import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { icover } from './icover.js';
import { findShop } from './index.js';
import { parseAmount, PriceNotFoundError } from './shop.js';
import { troli } from './troli.js';

/** Real product pages, trimmed: see the comment at the top of each file. */
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('shop adapters on real pages', () => {
  it('troli.shop: reads the product price, not the related products', () => {
    expect(troli.readPrice(fixture('troli-product.html'))).toEqual({ amount: 105, currency: 'UAH' });
  });

  it('icover.lt: reads the price from JSON-LD', () => {
    expect(icover.readPrice(fixture('icover-product.html'))).toEqual({ amount: 349, currency: 'EUR' });
  });

  it('fails loudly when the layout changes', () => {
    expect(() => troli.readPrice('<html><p class="price">105 ₴</p></html>')).toThrow(PriceNotFoundError);
    expect(() => icover.readPrice(fixture('troli-product.html'))).toThrow(/icover.lt: no price/);
  });

  it('refuses a price in another currency', () => {
    const html = '<meta itemprop="priceCurrency" content="USD"><meta itemprop="price" content="10">';
    expect(() => troli.readPrice(html)).toThrow(/expected UAH/);
  });
});

describe('parseAmount', () => {
  it.each([
    ['105', 105],
    ['349.00', 349],
    ['1 450,50', 1450.5],
    [349, 349],
  ])('%p -> %p', (raw, amount) => {
    expect(parseAmount(raw)).toBe(amount);
  });

  it.each(['', 'від 110', '0', '-5', '1.2.3', null, 0])('rejects %p', (raw) => {
    expect(parseAmount(raw)).toBeNaN();
  });
});

describe('findShop', () => {
  it('matches by hostname, with or without www', () => {
    expect(findShop('https://troli.shop/ua/chalk_block/')).toBe(troli);
    expect(findShop('https://www.icover.lt/apple-iphone-14')).toBe(icover);
  });

  it('returns undefined for other shops and broken URLs', () => {
    expect(findShop('https://rozetka.com.ua/item')).toBeUndefined();
    expect(findShop('not a url')).toBeUndefined();
  });
});
