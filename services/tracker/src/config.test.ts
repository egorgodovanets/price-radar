import { describe, expect, it } from '@jest/globals';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      port: 4001,
      mongoUrl: 'mongodb://localhost:27017',
      mongoDb: 'price-radar',
    });
  });

  it('reads values from the environment', () => {
    expect(
      loadConfig({ PORT: '5001', MONGO_URL: 'mongodb://mongo:27017', MONGO_DB: 'other' }),
    ).toEqual({ port: 5001, mongoUrl: 'mongodb://mongo:27017', mongoDb: 'other' });
  });

  it('treats empty MONGO_URL and MONGO_DB as not set', () => {
    expect(loadConfig({ MONGO_URL: '', MONGO_DB: '' })).toMatchObject({
      mongoUrl: 'mongodb://localhost:27017',
      mongoDb: 'price-radar',
    });
  });

  it.each(['abc', '', '0', '65536'])('rejects invalid PORT %p', (value) => {
    expect(() => loadConfig({ PORT: value })).toThrow(/PORT/);
  });
});
