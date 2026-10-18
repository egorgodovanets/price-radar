import { describe, expect, it } from '@jest/globals';
import { readJsonLdOffer, readMicrodataOffer } from './structuredData.js';

describe('readMicrodataOffer', () => {
  it('reads price and currency from meta tags in any attribute order', () => {
    const html = `<meta content="UAH" itemprop="priceCurrency"><meta itemprop='price' content='1450.5'>`;
    expect(readMicrodataOffer(html)).toEqual({ price: '1450.5', currency: 'UAH' });
  });

  it('takes the first price: the main product comes before related ones', () => {
    const html = '<meta itemprop="price" content="105"><meta itemprop="price" content="999">';
    expect(readMicrodataOffer(html)?.price).toBe('105');
  });

  it('returns null when there is no price', () => {
    expect(readMicrodataOffer('<meta itemprop="name" content="Mat">')).toBeNull();
  });
});

describe('readJsonLdOffer', () => {
  const script = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

  it('finds the Product among other blocks', () => {
    const html =
      script({ '@type': 'BreadcrumbList' }) +
      script({ '@type': 'Product', offers: { '@type': 'Offer', price: 349, priceCurrency: 'EUR' } });
    expect(readJsonLdOffer(html)).toEqual({ price: 349, currency: 'EUR' });
  });

  it('understands @graph, arrays of offers and @type arrays', () => {
    const html = script({
      '@graph': [{ '@type': 'WebPage' }, { '@type': ['Product', 'Thing'], offers: [{ price: '10.00', priceCurrency: 'EUR' }] }],
    });
    expect(readJsonLdOffer(html)).toEqual({ price: '10.00', currency: 'EUR' });
  });

  it('skips a broken block instead of failing', () => {
    const html = '<script type="application/ld+json">{ not json</script>' + script({ '@type': 'Product', offers: { price: 5 } });
    expect(readJsonLdOffer(html)).toEqual({ price: 5, currency: undefined });
  });

  it('returns null when no Product has an offer', () => {
    expect(readJsonLdOffer(script({ '@type': 'Product', name: 'Phone' }))).toBeNull();
    expect(readJsonLdOffer('<p>no scripts</p>')).toBeNull();
  });
});
