import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { jsonResponse } from '../test/fakeFetch';
import { GraphQLRequestError, requestGraphQL } from './client';

function mockFetch(implementation: () => Promise<Response>) {
  const fake = jest.fn<typeof fetch>(implementation);
  globalThis.fetch = fake;
  return fake;
}

describe('requestGraphQL', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('posts the query and variables to /graphql and returns data', async () => {
    const fake = mockFetch(() => Promise.resolve(jsonResponse({ data: { products: [] } })));

    await expect(requestGraphQL('query Products { products { id } }', { a: 1 })).resolves.toEqual({ products: [] });
    expect(fake).toHaveBeenCalledWith(
      '/graphql',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'query Products { products { id } }', variables: { a: 1 } }),
      }),
    );
  });

  it('turns the first GraphQL error into GraphQLRequestError with its code', async () => {
    mockFetch(() =>
      Promise.resolve(
        jsonResponse({ data: null, errors: [{ message: 'Already exists', extensions: { code: 'CONFLICT' } }] }),
      ),
    );

    const error = await requestGraphQL('mutation X { x }').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GraphQLRequestError);
    expect(error).toMatchObject({ message: 'Already exists', code: 'CONFLICT' });
  });

  it('reports NETWORK_ERROR when the server cannot be reached', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(requestGraphQL('{ x }')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('reports HTTP_ERROR when the body is not GraphQL JSON', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError('Bad JSON')) } as Response),
    );

    await expect(requestGraphQL('{ x }')).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      message: 'Server responded with 502',
    });
  });

  it('rethrows the abort error as is, so callers can ignore it', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    mockFetch(() => Promise.reject(abortError));
    controller.abort();

    await expect(requestGraphQL('{ x }', {}, controller.signal)).rejects.toBe(abortError);
  });
});
