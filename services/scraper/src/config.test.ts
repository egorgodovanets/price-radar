import { describe, expect, it } from '@jest/globals';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('falls back to defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      trackerUrl: 'http://localhost:4001',
      intervalMs: 60 * 60_000,
      requestDelayMs: 1000,
    });
  });

  it('reads every setting from the environment', () => {
    expect(
      loadConfig({ TRACKER_URL: 'http://tracker:4001', SCRAPE_INTERVAL_MINUTES: '5', SCRAPE_REQUEST_DELAY_MS: '0' }),
    ).toEqual({ trackerUrl: 'http://tracker:4001', intervalMs: 5 * 60_000, requestDelayMs: 0 });
  });

  it('treats empty values as not set', () => {
    expect(loadConfig({ TRACKER_URL: '', SCRAPE_INTERVAL_MINUTES: '' })).toEqual(loadConfig({}));
  });

  it.each(['0', '1441', '1.5', 'often'])('rejects invalid SCRAPE_INTERVAL_MINUTES %p', (value) => {
    expect(() => loadConfig({ SCRAPE_INTERVAL_MINUTES: value })).toThrow(/SCRAPE_INTERVAL_MINUTES/);
  });

  it.each(['-1', '60001', 'fast'])('rejects invalid SCRAPE_REQUEST_DELAY_MS %p', (value) => {
    expect(() => loadConfig({ SCRAPE_REQUEST_DELAY_MS: value })).toThrow(/SCRAPE_REQUEST_DELAY_MS/);
  });

  it.each(['tracker:4001', 'ftp://tracker'])('rejects invalid TRACKER_URL %p', (value) => {
    expect(() => loadConfig({ TRACKER_URL: value })).toThrow(/TRACKER_URL/);
  });
});
