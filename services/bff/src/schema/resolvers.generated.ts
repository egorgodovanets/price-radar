/* This file was automatically generated. DO NOT UPDATE MANUALLY. */
    import type   { Resolvers } from './types.generated.js';
    import    { product as Query_product } from './product/resolvers/Query/product.js';
import    { products as Query_products } from './product/resolvers/Query/products.js';
import    { watches as Query_watches } from './watch/resolvers/Query/watches.js';
import    { addProduct as Mutation_addProduct } from './product/resolvers/Mutation/addProduct.js';
import    { createWatch as Mutation_createWatch } from './watch/resolvers/Mutation/createWatch.js';
import    { deleteWatch as Mutation_deleteWatch } from './watch/resolvers/Mutation/deleteWatch.js';
import    { recordPrice as Mutation_recordPrice } from './price/resolvers/Mutation/recordPrice.js';
import    { Money } from './money/resolvers/Money.js';
import    { PricePoint } from './price/resolvers/PricePoint.js';
import    { Product } from './product/resolvers/Product.js';
import    { ProductAttribute } from './product/resolvers/ProductAttribute.js';
import    { Watch } from './watch/resolvers/Watch.js';
    export const resolvers: Resolvers = {
      Query: { product: Query_product,products: Query_products,watches: Query_watches },
      Mutation: { addProduct: Mutation_addProduct,createWatch: Mutation_createWatch,deleteWatch: Mutation_deleteWatch,recordPrice: Mutation_recordPrice },
      
      Money: Money,
PricePoint: PricePoint,
Product: Product,
ProductAttribute: ProductAttribute,
Watch: Watch
    }