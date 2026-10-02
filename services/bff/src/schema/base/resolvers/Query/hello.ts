import type { QueryResolvers } from './../../../types.generated.js';

export const hello: NonNullable<QueryResolvers['hello']> = () => 'Hello from BFF';