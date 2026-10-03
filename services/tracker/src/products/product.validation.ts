import { CATEGORIES, type Category, type CreateProductInput, type ProductAttributes } from './product.js';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}

function isCategory(value: unknown): value is Category {
  return CATEGORIES.some((category) => category === value);
}

function isAttributes(value: unknown): value is ProductAttributes {
  return (
    isPlainObject(value) &&
    Object.values(value).every((v) => ['string', 'number', 'boolean'].includes(typeof v))
  );
}

/** Checks an untrusted request body and turns it into CreateProductInput. */
export function validateCreateProduct(body: unknown): ValidationResult<CreateProductInput> {
  if (!isPlainObject(body)) {
    return { ok: false, errors: ['Body must be a JSON object'] };
  }

  const errors: string[] = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const { url, category, attributes = {} } = body;

  if (title === '') errors.push('title must be a non-empty string');
  if (!isHttpUrl(url)) errors.push('url must be an http(s) URL');
  if (!isCategory(category)) errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  if (!isAttributes(attributes)) {
    errors.push('attributes must be an object with string, number or boolean values');
  }

  // Same checks again: type guards inside an if narrow url/category/attributes for the return below.
  if (title === '' || !isHttpUrl(url) || !isCategory(category) || !isAttributes(attributes)) {
    return { ok: false, errors };
  }
  return { ok: true, value: { title, url, category, attributes } };
}