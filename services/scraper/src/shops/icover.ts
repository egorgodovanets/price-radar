import { toMoney, type Shop } from './shop.js';
import { readJsonLdOffer } from './structuredData.js';

/** Electronics in euros. The product page has a JSON-LD Product block. */
export const icover: Shop = {
  name: 'icover.lt',
  hosts: ['icover.lt'],
  currency: 'EUR',
  readPrice: (html) => toMoney(readJsonLdOffer(html), icover),
};
