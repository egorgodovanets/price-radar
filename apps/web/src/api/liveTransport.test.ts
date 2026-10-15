import { describe, expect, it } from '@jest/globals';
import { liveUrl, reconnectDelay } from './liveTransport';

describe('liveUrl', () => {
  it('uses ws on http pages and wss on https pages', () => {
    expect(liveUrl({ protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/graphql');
    expect(liveUrl({ protocol: 'https:', host: 'radar.example' })).toBe('wss://radar.example/graphql');
  });
});

describe('reconnectDelay', () => {
  it('doubles the wait after every failed attempt', () => {
    const noJitter = () => 1;
    expect([0, 1, 2, 3].map((retries) => reconnectDelay(retries, noJitter))).toEqual([1000, 2000, 4000, 8000]);
  });

  it('never waits longer than 30 seconds', () => {
    expect(reconnectDelay(20, () => 1)).toBe(30_000);
  });

  it('adds jitter: between half and the full delay', () => {
    expect(reconnectDelay(2, () => 0)).toBe(2000);
    expect(reconnectDelay(2, () => 0.5)).toBe(3000);
  });
});
