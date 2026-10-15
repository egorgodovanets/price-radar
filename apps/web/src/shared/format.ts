import type { Money } from '../api/operations';

// Fixed locale: the app is used in Ukraine, and tests get stable output.
const LOCALE = 'uk-UA';

export function formatMoney({ amount, currency }: Money): string {
  // narrowSymbol: "€" and "₴" instead of "EUR" and "грн".
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(
    amount,
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** "https://www.icover.lt/case" -> "icover.lt" */
export function shopName(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, '') : url;
}

export function isHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}

/** Amount typed by a user: a positive number, comma or dot as the decimal separator. */
export function parseAmount(raw: string): number | undefined {
  const amount = Number(raw.trim().replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(amount) && amount > 0 ? amount : undefined;
}
