import type { MutationResolvers } from './../../../types.generated.js';

export const addProduct: NonNullable<MutationResolvers['addProduct']> = (
  _parent,
  { input },
  { dataSources },
) =>
  // Tracker validates the fields; the BFF only reshapes attributes back into an object.
  dataSources.tracker.createProduct({
    title: input.title,
    url: input.url,
    category: input.category,
    // The schema default [] applies only when the field is omitted; the type still allows undefined.
    attributes: Object.fromEntries((input.attributes ?? []).map(({ name, value }) => [name, value])),
  });
