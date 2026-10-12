import { isMoney, MONEY_HINT, type Money } from '../common/money.js';
import type { ValidationResult } from '../common/validation.js';

export const DEFAULT_HISTORY_LIMIT = 30;
export const MAX_HISTORY_LIMIT = 100;

/** Checks an untrusted request body: the body itself is the price. */
export function validateRecordPrice(body: unknown): ValidationResult<Money> {
  if (!isMoney(body)) {
    return { ok: false, errors: [`Body must be ${MONEY_HINT}`] };
  }
  // Build a new object: unknown fields from the body never reach the database.
  return { ok: true, value: { amount: body.amount, currency: body.currency } };
}

/** Reads ?limit=. Query values arrive as strings, or as an array when the key is repeated. */
export function parseHistoryLimit(raw: unknown): ValidationResult<number> {
  if (raw === undefined) return { ok: true, value: DEFAULT_HISTORY_LIMIT };

  const limit = typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) {
    return { ok: false, errors: [`limit must be an integer between 1 and ${MAX_HISTORY_LIMIT}`] };
  }
  return { ok: true, value: limit };
}