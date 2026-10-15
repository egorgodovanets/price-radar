import { PRODUCT_QUERY, type ProductData } from '../../api/operations';
import { useQuery } from '../../api/useQuery';
import { ErrorMessage } from '../../shared/ErrorMessage';
import { formatDateTime, formatMoney, shopName } from '../../shared/format';
import { CreateWatchForm } from '../watches/CreateWatchForm';
import { WatchList } from '../watches/WatchList';
import { PriceChart } from './PriceChart';
import { PriceHistoryList } from './PriceHistoryList';
import { RecordPriceForm } from './RecordPriceForm';

const HISTORY_LIMIT = 30;

interface ProductDetailsProps {
  productId: string;
  /** Something that the product list shows has changed, e.g. the current price. */
  onChanged: () => void;
}

export function ProductDetails({ productId, onChanged }: ProductDetailsProps) {
  // One request for the product, its history and its watches: the BFF collects them from Tracker.
  const { data, error, refetch } = useQuery<ProductData>(PRODUCT_QUERY, {
    id: productId,
    historyLimit: HISTORY_LIMIT,
  });

  if (error) return <ErrorMessage error={error} onRetry={refetch} />;
  if (!data) return <p className="muted">Loading…</p>;

  const { product } = data;
  if (!product) return <p className="muted">This product no longer exists.</p>;

  const currency = product.currentPrice?.currency ?? 'UAH';

  return (
    <article className="details">
      <header>
        <h2>{product.title}</h2>
        <p className="product-item__meta">
          <a href={product.url} target="_blank" rel="noreferrer">
            {shopName(product.url)}
          </a>{' '}
          · {product.category}
        </p>
        {product.attributes.length > 0 && (
          <ul className="chips" aria-label="Attributes">
            {product.attributes.map(({ name, value }) => (
              <li key={name}>
                {name}: {value}
              </li>
            ))}
          </ul>
        )}
        <p className="current-price">
          {product.currentPrice ? formatMoney(product.currentPrice) : 'No price yet'}
          {product.priceUpdatedAt && <span className="muted"> · {formatDateTime(product.priceUpdatedAt)}</span>}
        </p>
      </header>

      <section>
        <h3>Price history</h3>
        <PriceChart history={product.priceHistory} />
        <PriceHistoryList history={product.priceHistory} />
        <RecordPriceForm
          productId={product.id}
          defaultCurrency={currency}
          onRecorded={() => {
            refetch();
            onChanged();
          }}
        />
      </section>

      <section>
        <h3>Watches</h3>
        <WatchList watches={product.watches} onDeleted={refetch} />
        <CreateWatchForm productId={product.id} defaultCurrency={currency} onCreated={refetch} />
      </section>
    </article>
  );
}
