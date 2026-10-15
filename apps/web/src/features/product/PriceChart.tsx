import type { PricePoint } from '../../api/operations';
import { formatMoney } from '../../shared/format';
import { buildChartPoints } from './chartPoints';

const WIDTH = 480;
const HEIGHT = 140;
const PADDING = 12;

interface PriceChartProps {
  /** Newest first, as the BFF returns it. */
  history: PricePoint[];
}

export function PriceChart({ history }: PriceChartProps) {
  const newest = history[0];
  if (!newest || history.length < 2) {
    return <p className="muted">The chart appears after the second recorded price.</p>;
  }

  const amounts = history.map((point) => point.price.amount).reverse();
  const points = buildChartPoints(amounts, WIDTH, HEIGHT, PADDING);
  const { currency } = newest.price;
  const min = formatMoney({ amount: Math.min(...amounts), currency });
  const max = formatMoney({ amount: Math.max(...amounts), currency });

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Price between ${min} and ${max}`}>
        <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} />
        {points.map(({ x, y }, index) => (
          <circle key={index} cx={x} cy={y} r={3} />
        ))}
      </svg>
      <figcaption className="muted">
        Min {min} · Max {max}
      </figcaption>
    </figure>
  );
}
