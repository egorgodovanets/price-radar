import { describe, expect, it } from '@jest/globals';
import { validateCreateWatch } from './watch.validation.js';

const valid = {
  productId: '6ac1219c8ffe84939f69873e',
  chatId: '123456789',
  targetPrice: { amount: 1500, currency: 'UAH' },
};

describe('validateCreateWatch', () => {
  it('accepts a valid watch', () => {
    expect(validateCreateWatch(valid)).toEqual({ ok: true, value: valid });
  });

  it('drops fields it does not know about', () => {
    const body = { ...valid, isAdmin: true, targetPrice: { ...valid.targetPrice, note: 'x' } };

    expect(validateCreateWatch(body)).toEqual({ ok: true, value: valid });
  });

  it('accepts a negative group chat id', () => {
    const result = validateCreateWatch({ ...valid, chatId: '-1001234567890' });

    expect(result.ok).toBe(true);
  });

  it.each([null, 'text', ['array']])('rejects a non-object body %p', (body) => {
    expect(validateCreateWatch(body)).toEqual({
      ok: false,
      errors: ['Body must be a JSON object'],
    });
  });

  it('reports every invalid field at once', () => {
    const result = validateCreateWatch({
      productId: 'x',
      chatId: 'abc',
      targetPrice: { amount: 0, currency: 'USD' },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(3);
    expect(result.errors.join(' ')).toMatch(/productId.*chatId.*targetPrice/);
  });

  it.each([
    [{ amount: -1, currency: 'UAH' }],
    [{ amount: '100', currency: 'UAH' }],
    [{ amount: 100 }],
    [100],
  ])('rejects invalid targetPrice %p', (targetPrice) => {
    expect(validateCreateWatch({ ...valid, targetPrice })).toEqual({
      ok: false,
      errors: [expect.stringMatching(/targetPrice/)],
    });
  });
});
