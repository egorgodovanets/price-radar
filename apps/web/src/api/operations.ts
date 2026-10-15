/**
 * Every GraphQL operation the UI sends, next to the TypeScript shape of its result.
 * The shapes mirror the BFF schema (services/bff/src/schema).
 */

export type Currency = 'UAH' | 'EUR';
export type Category = 'sport' | 'electronics';

export const CURRENCIES: readonly Currency[] = ['UAH', 'EUR'];
export const CATEGORIES: readonly Category[] = ['sport', 'electronics'];

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Attribute {
  name: string;
  value: string;
}

export interface ProductSummary {
  id: string;
  title: string;
  url: string;
  category: Category;
  currentPrice: Money | null;
  priceUpdatedAt: string | null;
}

export interface PricePoint {
  id: string;
  price: Money;
  observedAt: string;
}

export interface Watch {
  id: string;
  chatId: string;
  targetPrice: Money;
  createdAt: string;
}

export interface ProductDetails extends ProductSummary {
  attributes: Attribute[];
  createdAt: string;
  priceHistory: PricePoint[];
  watches: Watch[];
}

// The /* GraphQL */ comment lets editors highlight the strings.

export const PRODUCTS_QUERY = /* GraphQL */ `
  query Products {
    products {
      id
      title
      url
      category
      currentPrice { amount currency }
      priceUpdatedAt
    }
  }
`;
export interface ProductsData {
  products: ProductSummary[];
}

export const PRODUCT_QUERY = /* GraphQL */ `
  query Product($id: ID!, $historyLimit: Int!) {
    product(id: $id) {
      id
      title
      url
      category
      attributes { name value }
      currentPrice { amount currency }
      priceUpdatedAt
      createdAt
      priceHistory(limit: $historyLimit) {
        id
        price { amount currency }
        observedAt
      }
      watches {
        id
        chatId
        targetPrice { amount currency }
        createdAt
      }
    }
  }
`;
export interface ProductData {
  product: ProductDetails | null;
}

export const ADD_PRODUCT_MUTATION = /* GraphQL */ `
  mutation AddProduct($input: AddProductInput!) {
    addProduct(input: $input) { id }
  }
`;
export interface AddProductData {
  addProduct: { id: string };
}
export interface AddProductVariables extends Record<string, unknown> {
  input: { title: string; url: string; category: Category; attributes: Attribute[] };
}

export const RECORD_PRICE_MUTATION = /* GraphQL */ `
  mutation RecordPrice($productId: ID!, $price: MoneyInput!) {
    recordPrice(productId: $productId, price: $price) { id }
  }
`;
export interface RecordPriceData {
  recordPrice: { id: string };
}
export interface RecordPriceVariables extends Record<string, unknown> {
  productId: string;
  price: Money;
}

export const CREATE_WATCH_MUTATION = /* GraphQL */ `
  mutation CreateWatch($input: CreateWatchInput!) {
    createWatch(input: $input) { id }
  }
`;
export interface CreateWatchData {
  createWatch: { id: string };
}
export interface CreateWatchVariables extends Record<string, unknown> {
  input: { productId: string; chatId: string; targetPrice: Money };
}

export const DELETE_WATCH_MUTATION = /* GraphQL */ `
  mutation DeleteWatch($id: ID!) {
    deleteWatch(id: $id)
  }
`;
export interface DeleteWatchData {
  deleteWatch: boolean;
}
export interface DeleteWatchVariables extends Record<string, unknown> {
  id: string;
}

/** A recorded price that differs from the previous one, pushed by the BFF over WebSocket. */
export interface PriceChange {
  productId: string;
  price: Money;
  previousPrice: Money | null;
  observedAt: string;
}

export const PRICE_CHANGED_SUBSCRIPTION = /* GraphQL */ `
  subscription PriceChanged($productId: ID) {
    priceChanged(productId: $productId) {
      productId
      price { amount currency }
      previousPrice { amount currency }
      observedAt
    }
  }
`;
export interface PriceChangedData {
  priceChanged: PriceChange;
}
