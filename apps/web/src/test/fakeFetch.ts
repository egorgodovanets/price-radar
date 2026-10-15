import { jest } from '@jest/globals';

/** Minimal Response: only what requestGraphQL reads. jsdom has no fetch/Response of its own. */
export function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

export interface RecordedCall {
  operation: string;
  variables: Record<string, unknown>;
}

/** Builds the response body ({ data } or { errors }) for one operation. */
export type OperationHandler = (variables: Record<string, unknown>) => unknown;

/**
 * Replaces global fetch with a fake BFF that answers by operation name
 * ("query Products" -> handlers.Products) and records every call.
 */
export function installFakeBff(handlers: Record<string, OperationHandler>) {
  const calls: RecordedCall[] = [];
  const network = { down: false };

  globalThis.fetch = jest.fn<typeof fetch>((_input, init) => {
    if (network.down) return Promise.reject(new TypeError('Failed to fetch'));

    // requestGraphQL always sends a JSON string body.
    const { query, variables = {} } = JSON.parse(init?.body as string) as {
      query: string;
      variables?: Record<string, unknown>;
    };
    const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';
    calls.push({ operation, variables });

    const handler = handlers[operation];
    if (!handler) return Promise.reject(new Error(`Fake BFF has no handler for ${operation}`));
    return Promise.resolve(jsonResponse(handler(variables)));
  });

  return { calls, network };
}
