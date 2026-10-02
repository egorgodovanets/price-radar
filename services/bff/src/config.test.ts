import { describe, expect, it } from '@jest/globals';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('falls back to port 4000 when PORT is not set', () => {
    expect(loadConfig({})).toEqual({ port: 4000 });
  });

  it('reads PORT from the environment', () => {
    expect(loadConfig({ PORT: '5000' })).toEqual({ port: 5000 });
  });

  it.each(['abc', '', '0', '-1', '40.5', '65536'])('rejects invalid PORT %p', (value) => {
    expect(() => loadConfig({ PORT: value })).toThrow(/PORT/);
  });
});
