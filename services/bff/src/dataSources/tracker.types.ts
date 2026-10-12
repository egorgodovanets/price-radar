/**
 * JSON shapes of the Tracker REST API, as the BFF sees them.
 * Tracker owns these contracts; keep them in sync with its DTOs.
 */

export type Currency = 'UAH' | 'EUR';
export type Category = 'sport' | 'electronics';
export type AttributeValue = string | number | boolean;

export interface Money {
  amount: number;
  currency: Currency;
}

export interface ProductDto {
  id: string;
  title: string;
  url: string;
  category: Category;
  attributes: Record<string, AttributeValue>;
  currentPrice: Money | null;
  priceUpdatedAt: string | null;
  createdAt: string;
}

export interface CreateProductBody {
  title: string;
  url: string;
  category: Category;
  attributes: Record<string, AttributeValue>;
}

export interface PricePointDto {
  id: string;
  productId: string;
  price: Money;
  observedAt: string;
}

export interface WatchDto {
  id: string;
  productId: string;
  chatId: string;
  targetPrice: Money;
  createdAt: string;
}

export interface CreateWatchBody {
  productId: string;
  chatId: string;
  targetPrice: Money;
}
