import type { Money } from '../money.js';

/** The fields of a Tracker product that an alert needs. */
export interface TrackedProduct {
  id: string;
  title: string;
  url: string;
}

/** A watch as Tracker returns it: "message chatId when the price drops to targetPrice". */
export interface Watch {
  id: string;
  productId: string;
  chatId: string;
  targetPrice: Money;
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

/** Tracker's REST API, as Notifications uses it (read-only). */
export class TrackerClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async listWatches(productId: string): Promise<Watch[]> {
    return (await this.get(`/watches?productId=${encodeURIComponent(productId)}`)) as Watch[];
  }

  async getProduct(id: string): Promise<TrackedProduct> {
    return (await this.get(`/products/${encodeURIComponent(id)}`)) as TrackedProduct;
  }

  private async get(path: string): Promise<unknown> {
    const response = await fetch(new URL(path, this.baseUrl), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const errors = (payload as { errors?: unknown } | null)?.errors;
      const message = Array.isArray(errors) && typeof errors[0] === 'string' ? errors[0] : response.statusText;
      throw new TrackerError(response.status, `Tracker GET ${path} failed with ${response.status}: ${message}`);
    }
    return payload;
  }
}
