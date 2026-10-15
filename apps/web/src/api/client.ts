/** One entry of the "errors" array in a GraphQL response. */
interface GraphQLErrorPayload {
  message: string;
  extensions?: { code?: string };
}

interface GraphQLResponse<TData> {
  data?: TData | null;
  errors?: GraphQLErrorPayload[];
}

export type Variables = Record<string, unknown>;

/** A failed operation: the server is unreachable or the BFF returned errors. */
export class GraphQLRequestError extends Error {
  /** BFF error code (CONFLICT, BAD_USER_INPUT, ...) or NETWORK_ERROR / HTTP_ERROR. */
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'GraphQLRequestError';
    this.code = code;
  }
}

export function toRequestError(error: unknown): GraphQLRequestError {
  if (error instanceof GraphQLRequestError) return error;
  return new GraphQLRequestError(error instanceof Error ? error.message : 'Unknown error');
}

/** Same origin as the page; in development Vite proxies it to the BFF. */
export const GRAPHQL_ENDPOINT = '/graphql';

/**
 * Sends one query or mutation as POST /graphql.
 * Any error in the response fails the whole call: this UI never uses partial data.
 */
export async function requestGraphQL<TData>(
  query: string,
  variables?: Variables,
  signal?: AbortSignal,
): Promise<TData> {
  let response: Response;
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal,
    });
  } catch (error) {
    // An aborted request is not a failure; callers check signal.aborted and ignore it.
    if (signal?.aborted) throw error;
    throw new GraphQLRequestError('Cannot reach the server', 'NETWORK_ERROR');
  }

  const body = (await response.json().catch(() => null)) as GraphQLResponse<TData> | null;
  const firstError = body?.errors?.[0];
  if (firstError) {
    throw new GraphQLRequestError(firstError.message, firstError.extensions?.code);
  }
  if (!response.ok || !body?.data) {
    throw new GraphQLRequestError(`Server responded with ${response.status}`, 'HTTP_ERROR');
  }
  return body.data;
}
