import { useCallback, useEffect, useState } from 'react';
import { GraphQLRequestError, requestGraphQL, toRequestError, type Variables } from './client';

interface QueryResult<TData> {
  /** Which request produced this result; see loading below. */
  key: string;
  data: TData | undefined;
  error: GraphQLRequestError | undefined;
}

export interface QueryState<TData> {
  data: TData | undefined;
  error: GraphQLRequestError | undefined;
  loading: boolean;
  refetch: () => void;
}

/**
 * Runs a query on mount and whenever the query, variables or refetch() change.
 * Old data stays visible while a newer request is loading.
 */
export function useQuery<TData>(query: string, variables: Variables = {}): QueryState<TData> {
  // A new variables object is created on every render; its JSON is a stable dependency.
  const variablesKey = JSON.stringify(variables);
  const [reloads, setReloads] = useState(0);
  const requestKey = `${query}|${variablesKey}|${reloads}`;
  const [result, setResult] = useState<QueryResult<TData>>();

  useEffect(() => {
    const controller = new AbortController();

    requestGraphQL<TData>(query, JSON.parse(variablesKey) as Variables, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data, error: undefined });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult((previous) => ({ key: requestKey, data: previous?.data, error: toRequestError(error) }));
      });

    // Variables changed or the component unmounted: drop the old request,
    // so a slow old response never overwrites a newer one.
    return () => controller.abort();
  }, [query, variablesKey, requestKey]);

  const refetch = useCallback(() => setReloads((count) => count + 1), []);

  return {
    data: result?.data,
    error: result?.key === requestKey ? result.error : undefined,
    // Derived instead of stored: loading until a result for the current request arrives.
    loading: result?.key !== requestKey,
    refetch,
  };
}
