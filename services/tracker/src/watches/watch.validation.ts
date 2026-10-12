import { isObjectIdHex } from '../common/mongo.js';
import { CURRENCIES, isCurrency, type Money } from '../common/money.js';
import { isPlainObject, type ValidationResult } from '../common/validation.js';
import type { CreateWatchInput } from './watch.js';

/** Telegram chat ids are integers; group chats are negative. */
const CHAT_ID = /^-?\d{1,20}$/;

function isChatId(value: unknown): value is string {
  return typeof value === 'string' && CHAT_ID.test(value);
}

function isMoney(value: unknown): value is Money {
  return (
    isPlainObject(value) &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    isCurrency(value.currency)
  );
}

/** Checks an untrusted request body and turns it into CreateWatchInput. */
export function validateCreateWatch(body: unknown): ValidationResult<CreateWatchInput> {
  if (!isPlainObject(body)) {
    return { ok: false, errors: ['Body must be a JSON object'] };
  }

  const { productId, chatId, targetPrice } = body;
  const errors: string[] = [];

  if (!isObjectIdHex(productId)) errors.push('productId must be a 24-character hex id');
  if (!isChatId(chatId)) errors.push('chatId must be a Telegram chat id: digits, optionally negative');
  if (!isMoney(targetPrice)) {
    errors.push(`targetPrice must be { amount: number > 0, currency: ${CURRENCIES.join(' | ')} }`);
  }

  if (!isObjectIdHex(productId) || !isChatId(chatId) || !isMoney(targetPrice)) {
    return { ok: false, errors };
  }
  // Build a new object: unknown fields from the body never reach the database.
  return {
    ok: true,
    value: {
      productId,
      chatId,
      targetPrice: { amount: targetPrice.amount, currency: targetPrice.currency },
    },
  };
}