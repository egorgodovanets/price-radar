/** The parts of the Telegram Bot API objects this service reads. */
export interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramBotInfo {
  username: string;
}

/** Telegram answered { ok: false } or with an error status. */
export class TelegramError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TelegramError';
    this.status = status;
  }
}

const DEFAULT_API_URL = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

/** A thin client for the Telegram Bot API over fetch; no SDK needed for three methods. */
export class TelegramClient {
  private readonly token: string;
  private readonly apiUrl: string;

  constructor(token: string, apiUrl = DEFAULT_API_URL) {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  /** Checks the token and returns the bot's own account. */
  async getMe(): Promise<TelegramBotInfo> {
    return (await this.call('getMe', {})) as TelegramBotInfo;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.call('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
  }

  /**
   * Long polling: Telegram holds the request open up to timeoutSeconds until a message comes.
   * offset = last update_id + 1 confirms everything before it, so it is not returned again.
   */
  async getUpdates(offset: number | undefined, timeoutSeconds: number, signal: AbortSignal): Promise<TelegramUpdate[]> {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutSeconds * 1000 + TIMEOUT_MS)]);
    const params = { offset, timeout: timeoutSeconds, allowed_updates: ['message'] };
    return (await this.call('getUpdates', params, requestSignal)) as TelegramUpdate[];
  }

  private async call(method: string, params: object, signal = AbortSignal.timeout(TIMEOUT_MS)): Promise<unknown> {
    // The token is part of the URL: this URL must never be logged or put into an error.
    const response = await fetch(`${this.apiUrl}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: unknown; description?: string }
      | null;

    if (!response.ok || payload?.ok !== true) {
      const reason = payload?.description ?? response.statusText;
      throw new TelegramError(response.status, `Telegram ${method} failed with ${response.status}: ${reason}`);
    }
    return payload.result;
  }
}
