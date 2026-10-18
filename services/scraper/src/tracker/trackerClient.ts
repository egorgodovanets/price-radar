import type { Money } from '../money.js';

/** The fields of a Tracker product that the scraper needs. */
export interface TrackedProduct {
  id: string;
  title: string;
  url: string;
  currentPrice: Money | null;
}

/** Tracker answered with an error status; message comes from its { errors: [...] } body. */
export class TrackerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TrackerError';
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;

/** Tracker's REST API, as the scraper uses it. */
export class TrackerClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async listProducts(): Promise<TrackedProduct[]> {
    return (await this.request('GET', '/products')) as TrackedProduct[];
  }

  async recordPrice(productId: string, price: Money): Promise<void> {
    await this.request('POST', `/products/${encodeURIComponent(productId)}/prices`, price);
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const errors = (payload as { errors?: unknown } | null)?.errors;
      const message = Array.isArray(errors) && typeof errors[0] === 'string' ? errors[0] : response.statusText;
      throw new TrackerError(response.status, `Tracker ${method} ${path} failed with ${response.status}: ${message}`);
    }
    return payload;
  }
}
