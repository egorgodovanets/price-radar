import { describe, expect, it } from '@jest/globals';
import { loadConfig } from './config.js';

const TOKEN = '123456789:AAHfakeTokenForTests_0123456789';

describe('loadConfig', () => {
  it('falls back to defaults when only the token is set', () => {
    expect(loadConfig({ TELEGRAM_BOT_TOKEN: TOKEN })).toEqual({
      telegramBotToken: TOKEN,
      trackerUrl: 'http://localhost:4001',
      kafkaBrokers: null,
    });
  });

  it('reads every setting from the environment', () => {
    expect(
      loadConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TRACKER_URL: 'http://tracker:4001', KAFKA_BROKERS: 'kafka:19092, b2:9092' }),
    ).toEqual({ telegramBotToken: TOKEN, trackerUrl: 'http://tracker:4001', kafkaBrokers: 'kafka:19092,b2:9092' });
  });

  it.each([undefined, '', '   '])('requires TELEGRAM_BOT_TOKEN (%p)', (value) => {
    expect(() => loadConfig({ TELEGRAM_BOT_TOKEN: value })).toThrow(/TELEGRAM_BOT_TOKEN is not set/);
  });

  it('rejects a malformed token without printing it', () => {
    const attempt = () => loadConfig({ TELEGRAM_BOT_TOKEN: 'not-a-token-secret' });
    expect(attempt).toThrow(/Invalid TELEGRAM_BOT_TOKEN/);
    expect(attempt).not.toThrow(/not-a-token-secret/);
  });

  it.each(['tracker:4001', 'ftp://tracker'])('rejects invalid TRACKER_URL %p', (value) => {
    expect(() => loadConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TRACKER_URL: value })).toThrow(/TRACKER_URL/);
  });

  it('rejects invalid KAFKA_BROKERS', () => {
    expect(() => loadConfig({ TELEGRAM_BOT_TOKEN: TOKEN, KAFKA_BROKERS: 'kafka' })).toThrow(/KAFKA_BROKERS/);
  });
});
