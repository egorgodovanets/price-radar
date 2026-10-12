import { MongoServerError, ObjectId } from 'mongodb';

const OBJECT_ID_HEX = /^[a-f\d]{24}$/i;
const DUPLICATE_KEY_ERROR = 11000;

/** True for a 24-character hex string, the text form of an ObjectId. */
export function isObjectIdHex(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_HEX.test(value);
}

/** Converts an id from a URL or a body into an ObjectId; null if it cannot be one. */
export function toObjectId(id: string): ObjectId | null {
  return isObjectIdHex(id) ? new ObjectId(id) : null;
}

/** MongoDB rejected a write because it would break a unique index. */
export function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR;
}