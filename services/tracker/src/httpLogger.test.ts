import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import { httpLogger } from './httpLogger.js';

describe('httpLogger', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = express();
    app.use(httpLogger);
    app.get('/ping', (req, res) => {
      res.json({ id: req.id });
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('gives every request a new id and returns it in X-Request-Id', async () => {
    const [first, second] = await Promise.all([fetch(`${baseUrl}/ping`), fetch(`${baseUrl}/ping`)]);
    const id = first?.headers.get('x-request-id');

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(second?.headers.get('x-request-id')).not.toBe(id);
    await expect(first?.json()).resolves.toEqual({ id });
  });

  it("keeps the caller's id, so one id follows a request across services", async () => {
    const response = await fetch(`${baseUrl}/ping`, { headers: { 'x-request-id': 'from-bff-42' } });

    expect(response.headers.get('x-request-id')).toBe('from-bff-42');
  });

  it('replaces an id that does not look like one', async () => {
    const response = await fetch(`${baseUrl}/ping`, { headers: { 'x-request-id': '<script>alert(1)</script>' } });

    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
