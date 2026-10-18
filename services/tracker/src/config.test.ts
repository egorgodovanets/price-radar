import { describe, expect, it } from '@jest/globals';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      port: 4001,
      mongoUrl: 'mongodb://localhost:27017',
      mongoDb: 'price-radar',
      kafkaBrokers: null,
    });
  });

  it('reads values from the environment', () => {
    expect(
      loadConfig({ PORT: '5001', MONGO_URL: 'mongodb://mongo:27017', MONGO_DB: 'other', KAFKA_BROKERS: 'kafka:19092' }),
    ).toEqual({ port: 5001, mongoUrl: 'mongodb://mongo:27017', mongoDb: 'other', kafkaBrokers: 'kafka:19092' });
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

  it('turns Kafka off when KAFKA_BROKERS is empty', () => {
    expect(loadConfig({ KAFKA_BROKERS: ' ' }).kafkaBrokers).toBeNull();
  });

  it('accepts a list of brokers and trims spaces', () => {
    expect(loadConfig({ KAFKA_BROKERS: 'kafka-1:9092, kafka-2:9092' }).kafkaBrokers).toBe('kafka-1:9092,kafka-2:9092');
  });

  it.each(['kafka', 'http://kafka:9092', 'kafka:9092,'])('rejects invalid KAFKA_BROKERS %p', (value) => {
    expect(() => loadConfig({ KAFKA_BROKERS: value })).toThrow(/KAFKA_BROKERS/);
  });
});
