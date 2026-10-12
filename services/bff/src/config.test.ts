import { describe, expect, it } from '@jest/globals';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('falls back to defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({ port: 4000, trackerUrl: 'http://localhost:4001' });
  });

  it('reads PORT from the environment', () => {
    expect(loadConfig({ PORT: '5000' }).port).toBe(5000);
  });

  it.each(['abc', '', '0', '-1', '40.5', '65536'])('rejects invalid PORT %p', (value) => {
    expect(() => loadConfig({ PORT: value })).toThrow(/PORT/);
  });

  it('reads TRACKER_URL from the environment', () => {
    expect(loadConfig({ TRACKER_URL: 'http://tracker:4001' }).trackerUrl).toBe('http://tracker:4001');
  });

  it('treats an empty TRACKER_URL as not set', () => {
    expect(loadConfig({ TRACKER_URL: '' }).trackerUrl).toBe('http://localhost:4001');
  });

  it.each(['localhost:4001', 'tracker', 'ftp://tracker'])('rejects invalid TRACKER_URL %p', (value) => {
    expect(() => loadConfig({ TRACKER_URL: value })).toThrow(/TRACKER_URL/);
  });
});
