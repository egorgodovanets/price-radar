import { useCallback, useState } from 'react';
import { GraphQLRequestError, requestGraphQL, toRequestError, type Variables } from './client';

interface MutationState {
  loading: boolean;
  error: GraphQLRequestError | undefined;
}

/**
 * Returns [mutate, state]. mutate() resolves to the data, or to undefined on failure;
 * the failure itself is in state.error, so components do not need try/catch.
 */
export function useMutation<TData, TVariables extends Variables>(mutation: string) {
  const [state, setState] = useState<MutationState>({ loading: false, error: undefined });

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      setState({ loading: true, error: undefined });
      try {
        const data = await requestGraphQL<TData>(mutation, variables);
        setState({ loading: false, error: undefined });
        return data;
      } catch (error) {
        setState({ loading: false, error: toRequestError(error) });
        return undefined;
      }
    },
    [mutation],
  );

  return [mutate, state] as const;
}
