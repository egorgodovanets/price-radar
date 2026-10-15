import type { PricePoint } from '../../api/operations';
import { formatDateTime, formatMoney } from '../../shared/format';

interface PriceHistoryListProps {
  /** Newest first. */
  history: PricePoint[];
}

export function PriceHistoryList({ history }: PriceHistoryListProps) {
  if (history.length === 0) return <p className="muted">No prices recorded yet.</p>;

  return (
    <table className="history">
      <thead>
        <tr>
          <th scope="col">When</th>
          <th scope="col">Price</th>
          <th scope="col">Change</th>
        </tr>
      </thead>
      <tbody>
        {history.map((point, index) => {
          // The list is newest first, so the previous price is the next element.
          const previous = history[index + 1];
          const change = previous ? point.price.amount - previous.price.amount : 0;
          return (
            <tr key={point.id}>
              <td>{formatDateTime(point.observedAt)}</td>
              <td>{formatMoney(point.price)}</td>
              <td className={change < 0 ? 'down' : change > 0 ? 'up' : 'muted'}>
                {change === 0 ? '—' : `${change > 0 ? '+' : '−'}${formatMoney({ ...point.price, amount: Math.abs(change) })}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
