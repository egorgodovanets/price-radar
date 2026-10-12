import type { MutationResolvers } from './../../../types.generated.js';

export const deleteWatch: NonNullable<MutationResolvers['deleteWatch']> = (
  _parent,
  { id },
  { dataSources },
) => dataSources.tracker.deleteWatch(id);
