import { icover } from './icover.js';
import type { Shop } from './shop.js';
import { troli } from './troli.js';

export const SHOPS: readonly Shop[] = [troli, icover];

/** The adapter for a product URL, or undefined if the shop is not supported. */
export function findShop(url: string, shops: readonly Shop[] = SHOPS): Shop | undefined {
  if (!URL.canParse(url)) return undefined;
  const host = new URL(url).hostname.replace(/^www\./, '');
  return shops.find((shop) => shop.hosts.includes(host));
}
