import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { TelegramClient, TelegramError } from './telegramClient.js';

const TOKEN = '123:secret-token';

function respond(status: number, body: unknown) {
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  globalThis.fetch = fetchMock;
  return fetchMock;
}

const realFetch = globalThis.fetch;

describe('TelegramClient', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends a message as a JSON POST to the bot method URL', async () => {
    const fetchMock = respond(200, { ok: true, result: { message_id: 1 } });

    await new TelegramClient(TOKEN, 'http://telegram.test').sendMessage('42', 'Hello');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://telegram.test/bot123:secret-token/sendMessage');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toMatchObject({ chat_id: '42', text: 'Hello' });
  });

  it('asks for updates after the given offset with long polling', async () => {
    const updates = [{ update_id: 7, message: { chat: { id: 42 }, text: '/start' } }];
    const fetchMock = respond(200, { ok: true, result: updates });

    await expect(new TelegramClient(TOKEN).getUpdates(7, 30, new AbortController().signal)).resolves.toEqual(updates);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      offset: 7,
      timeout: 30,
      allowed_updates: ['message'],
    });
  });

  it("turns { ok: false } into TelegramError with Telegram's description, without the token", async () => {
    respond(403, { ok: false, description: 'Forbidden: bot was blocked by the user' });

    const error = await new TelegramClient(TOKEN).sendMessage('42', 'Hi').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TelegramError);
    expect(error).toMatchObject({ status: 403, message: expect.stringContaining('blocked by the user') });
    expect((error as Error).message).not.toContain('secret-token');
  });
});
