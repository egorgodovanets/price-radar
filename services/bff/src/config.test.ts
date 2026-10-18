import { describe, expect, it } from '@jest/globals';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('falls back to defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      port: 4000,
      trackerUrl: 'http://localhost:4001',
      redisUrl: 'redis://localhost:6379',
      kafkaBrokers: null,
    });
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

  it('reads REDIS_URL from the environment', () => {
    expect(loadConfig({ REDIS_URL: 'redis://redis:6379' }).redisUrl).toBe('redis://redis:6379');
  });

  it.each(['http://redis:6379', 'redis'])('rejects invalid REDIS_URL %p', (value) => {
    expect(() => loadConfig({ REDIS_URL: value })).toThrow(/REDIS_URL/);
  });

  it('reads KAFKA_BROKERS and treats an empty value as Kafka off', () => {
    expect(loadConfig({ KAFKA_BROKERS: 'kafka:19092' }).kafkaBrokers).toBe('kafka:19092');
    expect(loadConfig({ KAFKA_BROKERS: '' }).kafkaBrokers).toBeNull();
  });

  it.each(['kafka', 'kafka:9092,'])('rejects invalid KAFKA_BROKERS %p', (value) => {
    expect(() => loadConfig({ KAFKA_BROKERS: value })).toThrow(/KAFKA_BROKERS/);
  });
});
