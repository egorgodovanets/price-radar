import { toMoney, type Shop } from './shop.js';
import { readMicrodataOffer } from './structuredData.js';

/** Sports equipment in hryvnias. OpenCart: the product block carries schema.org microdata. */
export const troli: Shop = {
  name: 'troli.shop',
  hosts: ['troli.shop'],
  currency: 'UAH',
  readPrice: (html) => toMoney(readMicrodataOffer(html), troli),
};
