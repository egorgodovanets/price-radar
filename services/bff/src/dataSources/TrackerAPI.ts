import { RESTDataSource, type DataSourceConfig } from '@apollo/datasource-rest';
import { GraphQLError } from 'graphql';
import type {
  CreateProductBody,
  CreateWatchBody,
  Money,
  PricePointDto,
  ProductDto,
  WatchDto,
} from './tracker.types.js';

/**
 * Tracker statuses the client can act on, as GraphQL error codes.
 * Everything else (5xx, unexpected codes) becomes BAD_GATEWAY with a generic message.
 */
const CODE_BY_STATUS = new Map<number, string>([
  [400, 'BAD_USER_INPUT'],
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
  [422, 'BAD_USER_INPUT'],
]);

/** Tracker answers errors as { errors: string[] }; take the first message. */
function firstTrackerError(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('errors' in body)) return undefined;
  const { errors } = body;
  return Array.isArray(errors) && typeof errors[0] === 'string' ? errors[0] : undefined;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof GraphQLError && error.extensions.code === 'NOT_FOUND';
}

/** Ids go into the URL path; encoding stops values like "../watches" from reaching other routes. */
const segment = encodeURIComponent;

/**
 * REST client for Tracker. Create one per GraphQL operation (see server.ts):
 * identical GETs that run at the same time inside one operation are sent once.
 */
export class TrackerAPI extends RESTDataSource {
  constructor(baseURL: string, config?: DataSourceConfig) {
    super(config);
    // The trailing slash makes 'products' resolve under the base path instead of replacing it.
    this.baseURL = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
  }

  /** Called for every non-2xx response; the returned error is what resolvers see. */
  protected override errorFromResponse({
    response,
    parsedBody,
  }: {
    response: { status: number };
    parsedBody: unknown;
  }): Promise<GraphQLError> {
    const code = CODE_BY_STATUS.get(response.status);
    const error = code
      ? new GraphQLError(firstTrackerError(parsedBody) ?? `Tracker responded with ${response.status}`, {
          extensions: { code },
        })
      : new GraphQLError('Tracker request failed', { extensions: { code: 'BAD_GATEWAY' } });
    return Promise.resolve(error);
  }

  /** Called before any error is rethrown; network failures (Tracker down) get a clear code too. */
  protected override didEncounterError(error: Error): void {
    if (error instanceof GraphQLError) return;
    throw new GraphQLError('Tracker is unavailable', {
      extensions: { code: 'BAD_GATEWAY' },
      originalError: error,
    });
  }

  getProducts(): Promise<ProductDto[]> {
    return this.get<ProductDto[]>('products');
  }

  /** Null instead of an error: "no such product" is a normal answer for a lookup. */
  async getProduct(id: string): Promise<ProductDto | null> {
    try {
      return await this.get<ProductDto>(`products/${segment(id)}`);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  createProduct(body: CreateProductBody): Promise<ProductDto> {
    return this.post<ProductDto>('products', { body });
  }

  /** Newest first. */
  getPriceHistory(productId: string, limit: number): Promise<PricePointDto[]> {
    return this.get<PricePointDto[]>(`products/${segment(productId)}/prices`, {
      params: { limit: String(limit) },
    });
  }

  recordPrice(productId: string, price: Money): Promise<PricePointDto> {
    return this.post<PricePointDto>(`products/${segment(productId)}/prices`, { body: price });
  }

  /** All watches, or only those of one product. */
  getWatches(productId?: string): Promise<WatchDto[]> {
    return this.get<WatchDto[]>('watches', { params: { productId } });
  }

  createWatch(body: CreateWatchBody): Promise<WatchDto> {
    return this.post<WatchDto>('watches', { body });
  }

  /** False when the watch did not exist. */
  async deleteWatch(id: string): Promise<boolean> {
    try {
      await this.delete<unknown>(`watches/${segment(id)}`);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }
}
