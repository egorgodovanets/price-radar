/**
 * Shops describe their products for search engines with schema.org data.
 * It is far more stable than the visible HTML, so adapters read prices from it.
 */

/** Price and currency as written on the page, not checked yet. */
export interface RawOffer {
  price: unknown;
  currency: unknown;
}

const ATTRIBUTE = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const META_TAG = /<meta\b[^>]*>/gi;
const JSON_LD_SCRIPT = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function readAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const [, name, doubleQuoted, singleQuoted] of tag.matchAll(ATTRIBUTE)) {
    if (name) attributes.set(name.toLowerCase(), doubleQuoted ?? singleQuoted ?? '');
  }
  return attributes;
}

/**
 * Microdata: <meta itemprop="price" content="105"> and <meta itemprop="priceCurrency" content="UAH">.
 * The first of each wins: it belongs to the main product, related products come later.
 */
export function readMicrodataOffer(html: string): RawOffer | null {
  let price: string | undefined;
  let currency: string | undefined;

  for (const [tag] of html.matchAll(META_TAG)) {
    const attributes = readAttributes(tag);
    const property = attributes.get('itemprop');
    if (property === 'price') price ??= attributes.get('content');
    if (property === 'priceCurrency') currency ??= attributes.get('content');
  }
  return price === undefined ? null : { price, currency };
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasType(node: JsonObject, type: string): boolean {
  const value = node['@type'];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/** A JSON-LD block can be one object, an array, or an object with an @graph array. */
function findProduct(data: unknown): JsonObject | undefined {
  if (Array.isArray(data)) {
    for (const item of data) {
      const product = findProduct(item);
      if (product) return product;
    }
    return undefined;
  }
  if (!isObject(data)) return undefined;
  if (hasType(data, 'Product')) return data;
  return findProduct(data['@graph']);
}

/** JSON-LD: <script type="application/ld+json">{"@type":"Product","offers":{"price":349,...}}</script>. */
export function readJsonLdOffer(html: string): RawOffer | null {
  for (const [, body = ''] of html.matchAll(JSON_LD_SCRIPT)) {
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      // One broken block (shops do ship them) must not hide the others.
      continue;
    }

    const offers = findProduct(data)?.offers;
    const offer: unknown = Array.isArray(offers) ? offers[0] : offers;
    if (isObject(offer) && offer.price !== undefined) {
      return { price: offer.price, currency: offer.priceCurrency };
    }
  }
  return null;
}
