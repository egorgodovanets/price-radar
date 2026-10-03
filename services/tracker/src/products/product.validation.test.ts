import { describe, expect, it } from '@jest/globals';
import { validateCreateProduct } from './product.validation.js';

const valid = {
  title: 'Yoga mat',
  url: 'https://troli.shop/ua/yoga-mat',
  category: 'sport',
  attributes: { color: 'blue', thicknessMm: 6 },
};

describe('validateCreateProduct', () => {
  it('accepts a valid product and trims the title', () => {
    expect(validateCreateProduct({ ...valid, title: '  Yoga mat  ' })).toEqual({
      ok: true,
      value: valid,
    });
  });

  it('defaults attributes to an empty object', () => {
    const { attributes: _omitted, ...withoutAttributes } = valid;

    expect(validateCreateProduct(withoutAttributes)).toEqual({
      ok: true,
      value: { ...withoutAttributes, attributes: {} },
    });
  });

  it.each([null, 'text', 42, ['array']])('rejects a non-object body %p', (body) => {
    expect(validateCreateProduct(body)).toEqual({
      ok: false,
      errors: ['Body must be a JSON object'],
    });
  });

  it('reports every invalid field at once', () => {
    const result = validateCreateProduct({ title: ' ', url: 'ftp://x', category: 'food' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(3);
    expect(result.errors.join(' ')).toMatch(/title.*url.*category/);
  });

  it.each([[['a']], [{ nested: { deep: 1 } }], ['plain string']])(
    'rejects invalid attributes %p',
    (attributes) => {
      expect(validateCreateProduct({ ...valid, attributes })).toEqual({
        ok: false,
        errors: [expect.stringMatching(/attributes/)],
      });
    },
  );
});
