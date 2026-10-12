import type { GraphQLResolveInfo } from 'graphql';
import type { PricePointMapper } from './price/schema.mappers.js';
import type { ProductMapper } from './product/schema.mappers.js';
import type { WatchMapper } from './watch/schema.mappers.js';
import type { GraphQLContext } from '../context.js';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type EnumResolverSignature<T, AllowedValues = any> = { [key in keyof T]?: AllowedValues };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string | number; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AddProductInput = {
  attributes?: Array<ProductAttributeInput>;
  category: Category;
  title: Scalars['String']['input'];
  /** Product page in a supported shop; one product per URL. */
  url: Scalars['String']['input'];
};

/** Values match Tracker, which stores categories in lower case. */
export type Category =
  | 'electronics'
  | 'sport';

export type CreateWatchInput = {
  chatId: Scalars['String']['input'];
  productId: Scalars['ID']['input'];
  targetPrice: MoneyInput;
};

/** Currencies of the shops we track. */
export type Currency =
  | 'EUR'
  | 'UAH';

/** A price in major units: hryvnias, euros. */
export type Money = {
  __typename?: 'Money';
  amount: Scalars['Float']['output'];
  currency: Currency;
};

export type MoneyInput = {
  /** Must be greater than 0. */
  amount: Scalars['Float']['input'];
  currency: Currency;
};

export type Mutation = {
  __typename?: 'Mutation';
  addProduct: Product;
  createWatch: Watch;
  /** False when the watch did not exist. */
  deleteWatch: Scalars['Boolean']['output'];
  /** Adds a price by hand; the scraper does the same through Tracker's REST API. */
  recordPrice: PricePoint;
};


export type MutationaddProductArgs = {
  input: AddProductInput;
};


export type MutationcreateWatchArgs = {
  input: CreateWatchInput;
};


export type MutationdeleteWatchArgs = {
  id: Scalars['ID']['input'];
};


export type MutationrecordPriceArgs = {
  price: MoneyInput;
  productId: Scalars['ID']['input'];
};

/** One observed price of a product. */
export type PricePoint = {
  __typename?: 'PricePoint';
  id: Scalars['ID']['output'];
  /** ISO 8601. */
  observedAt: Scalars['String']['output'];
  price: Money;
};

export type Product = {
  __typename?: 'Product';
  attributes: Array<ProductAttribute>;
  category: Category;
  /** ISO 8601. */
  createdAt: Scalars['String']['output'];
  /** Latest recorded price; null until the first price arrives. */
  currentPrice?: Maybe<Money>;
  id: Scalars['ID']['output'];
  /** Recorded prices, newest first. limit: 1 to 100. */
  priceHistory: Array<PricePoint>;
  /** ISO 8601 time of currentPrice. */
  priceUpdatedAt?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  url: Scalars['String']['output'];
  watches: Array<Watch>;
};


export type ProductpriceHistoryArgs = {
  limit?: Scalars['Int']['input'];
};

/**
 * One category-specific detail, e.g. name "color", value "blue".
 * GraphQL has no map type, so Tracker's attributes object travels as a list of pairs.
 */
export type ProductAttribute = {
  __typename?: 'ProductAttribute';
  name: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type ProductAttributeInput = {
  name: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type Query = {
  __typename?: 'Query';
  /** Null when the product does not exist. */
  product?: Maybe<Product>;
  /** Newest first. */
  products: Array<Product>;
  /** All watches, or only those of one product. */
  watches: Array<Watch>;
};


export type QueryproductArgs = {
  id: Scalars['ID']['input'];
};


export type QuerywatchesArgs = {
  productId?: InputMaybe<Scalars['ID']['input']>;
};

/** A request to be notified in Telegram when a product gets cheap enough. */
export type Watch = {
  __typename?: 'Watch';
  /** Telegram chat that receives the notification. */
  chatId: Scalars['String']['output'];
  /** ISO 8601. */
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  product: Product;
  /** Notify when the price drops to this value or below. */
  targetPrice: Money;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AddProductInput: AddProductInput;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Category: ResolverTypeWrapper<'sport' | 'electronics'>;
  CreateWatchInput: CreateWatchInput;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Currency: ResolverTypeWrapper<'UAH' | 'EUR'>;
  Money: ResolverTypeWrapper<Omit<Money, 'currency'> & { currency: ResolversTypes['Currency'] }>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  MoneyInput: MoneyInput;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  PricePoint: ResolverTypeWrapper<PricePointMapper>;
  Product: ResolverTypeWrapper<ProductMapper>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  ProductAttribute: ResolverTypeWrapper<ProductAttribute>;
  ProductAttributeInput: ProductAttributeInput;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Watch: ResolverTypeWrapper<WatchMapper>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AddProductInput: AddProductInput;
  String: Scalars['String']['output'];
  CreateWatchInput: CreateWatchInput;
  ID: Scalars['ID']['output'];
  Money: Money;
  Float: Scalars['Float']['output'];
  MoneyInput: MoneyInput;
  Mutation: Record<PropertyKey, never>;
  Boolean: Scalars['Boolean']['output'];
  PricePoint: PricePointMapper;
  Product: ProductMapper;
  Int: Scalars['Int']['output'];
  ProductAttribute: ProductAttribute;
  ProductAttributeInput: ProductAttributeInput;
  Query: Record<PropertyKey, never>;
  Watch: WatchMapper;
};

export type CategoryResolvers = EnumResolverSignature<{ electronics?: any, sport?: any }, ResolversTypes['Category']>;

export type CurrencyResolvers = EnumResolverSignature<{ EUR?: any, UAH?: any }, ResolversTypes['Currency']>;

export type MoneyResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Money'] = ResolversParentTypes['Money']> = {
  amount?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['Currency'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addProduct?: Resolver<ResolversTypes['Product'], ParentType, ContextType, RequireFields<MutationaddProductArgs, 'input'>>;
  createWatch?: Resolver<ResolversTypes['Watch'], ParentType, ContextType, RequireFields<MutationcreateWatchArgs, 'input'>>;
  deleteWatch?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationdeleteWatchArgs, 'id'>>;
  recordPrice?: Resolver<ResolversTypes['PricePoint'], ParentType, ContextType, RequireFields<MutationrecordPriceArgs, 'price' | 'productId'>>;
};

export type PricePointResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['PricePoint'] = ResolversParentTypes['PricePoint']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  observedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  price?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
};

export type ProductResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Product'] = ResolversParentTypes['Product']> = {
  attributes?: Resolver<Array<ResolversTypes['ProductAttribute']>, ParentType, ContextType>;
  category?: Resolver<ResolversTypes['Category'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  currentPrice?: Resolver<Maybe<ResolversTypes['Money']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  priceHistory?: Resolver<Array<ResolversTypes['PricePoint']>, ParentType, ContextType, RequireFields<ProductpriceHistoryArgs, 'limit'>>;
  priceUpdatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  watches?: Resolver<Array<ResolversTypes['Watch']>, ParentType, ContextType>;
};

export type ProductAttributeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ProductAttribute'] = ResolversParentTypes['ProductAttribute']> = {
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  product?: Resolver<Maybe<ResolversTypes['Product']>, ParentType, ContextType, RequireFields<QueryproductArgs, 'id'>>;
  products?: Resolver<Array<ResolversTypes['Product']>, ParentType, ContextType>;
  watches?: Resolver<Array<ResolversTypes['Watch']>, ParentType, ContextType, Partial<QuerywatchesArgs>>;
};

export type WatchResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Watch'] = ResolversParentTypes['Watch']> = {
  chatId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  product?: Resolver<ResolversTypes['Product'], ParentType, ContextType>;
  targetPrice?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  Category?: CategoryResolvers;
  Currency?: CurrencyResolvers;
  Money?: MoneyResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PricePoint?: PricePointResolvers<ContextType>;
  Product?: ProductResolvers<ContextType>;
  ProductAttribute?: ProductAttributeResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Watch?: WatchResolvers<ContextType>;
};

