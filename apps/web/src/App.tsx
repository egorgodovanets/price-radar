import { useState } from 'react';
import { PRODUCTS_QUERY, type ProductsData } from './api/operations';
import { useQuery } from './api/useQuery';
import { ProductDetails } from './features/product/ProductDetails';
import { AddProductForm } from './features/products/AddProductForm';
import { ProductList } from './features/products/ProductList';

export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const products = useQuery<ProductsData>(PRODUCTS_QUERY);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Price Radar</h1>
        <p>Watch prices in online shops and get a Telegram message when they drop.</p>
      </header>

      <main className="layout">
        <section className="panel" aria-label="Products">
          <ProductList
            products={products.data?.products}
            loading={products.loading}
            error={products.error}
            onRetry={products.refetch}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <AddProductForm
            onAdded={(productId) => {
              products.refetch();
              setSelectedId(productId);
            }}
          />
        </section>

        <section className="panel" aria-label="Product details">
          {selectedId ? (
            // key: a new product gets a fresh component, so forms and requests do not leak between products.
            <ProductDetails key={selectedId} productId={selectedId} onChanged={products.refetch} />
          ) : (
            <p className="muted">Select a product to see its price history and watches.</p>
          )}
        </section>
      </main>
    </div>
  );
}
