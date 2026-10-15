import type { GraphQLRequestError } from '../../api/client';
import type { ProductSummary } from '../../api/operations';
import { ErrorMessage } from '../../shared/ErrorMessage';
import { formatMoney, shopName } from '../../shared/format';

interface ProductListProps {
  products: ProductSummary[] | undefined;
  loading: boolean;
  error: GraphQLRequestError | undefined;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (productId: string) => void;
}

export function ProductList({ products, loading, error, onRetry, selectedId, onSelect }: ProductListProps) {
  return (
    <div>
      <h2>Products</h2>
      {error && <ErrorMessage error={error} onRetry={onRetry} />}
      {!products && loading && <p className="muted">Loading…</p>}
      {products?.length === 0 && <p className="muted">No products yet. Add the first one below.</p>}

      {products && products.length > 0 && (
        <ul className="product-list">
          {products.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="product-item"
                aria-pressed={product.id === selectedId}
                onClick={() => onSelect(product.id)}
              >
                <span className="product-item__title">{product.title}</span>
                <span className="product-item__meta">
                  {shopName(product.url)} · {product.category}
                </span>
                <span className="product-item__price">
                  {product.currentPrice ? formatMoney(product.currentPrice) : 'No price yet'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
