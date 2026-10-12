import type { MutationResolvers } from './../../../types.generated.js';

export const createWatch: NonNullable<MutationResolvers['createWatch']> = (
  _parent,
  { input },
  { dataSources },
) =>
  dataSources.tracker.createWatch({
    productId: input.productId,
    chatId: input.chatId,
    targetPrice: { amount: input.targetPrice.amount, currency: input.targetPrice.currency },
  });
