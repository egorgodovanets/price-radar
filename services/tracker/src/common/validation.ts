export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}