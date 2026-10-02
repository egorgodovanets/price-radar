import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createServer, type BffServer } from './server.js';

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: { message: string; extensions?: { code?: string } }[];
}

describe('BFF server', () => {
  let server: BffServer | undefined;
  let baseUrl = '';

  const postGraphQL = (query: string) =>
    fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });

  beforeAll(async () => {
    const created = await createServer();
    server = created;
    await new Promise<void>((resolve) => created.httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = created.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await server?.stop();
  });

  it('responds to GET /health', async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('resolves the hello query over HTTP', async () => {
    const res = await postGraphQL('{ hello }');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hello: 'Hello from BFF' } });
  });

  it('rejects unknown fields with a validation error', async () => {
    const res = await postGraphQL('{ unknownField }');
    const body = (await res.json()) as GraphQLResponse;

    expect(res.status).toBe(400);
    expect(body.errors?.[0]?.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
  });

  it('closes the HTTP server on stop()', async () => {
    await server?.stop();
    const httpServer = server?.httpServer;
    server = undefined;

    expect(httpServer?.listening).toBe(false);
  });
});
