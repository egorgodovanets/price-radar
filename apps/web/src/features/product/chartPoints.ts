export interface ChartPoint {
  x: number;
  y: number;
}

/**
 * Maps amounts (oldest first) to SVG coordinates inside a width x height box.
 * SVG y grows downwards, so a higher price gets a smaller y.
 */
export function buildChartPoints(amounts: number[], width: number, height: number, padding: number): ChartPoint[] {
  if (amounts.length === 0) return [];

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const stepX = amounts.length > 1 ? innerWidth / (amounts.length - 1) : 0;

  return amounts.map((amount, index) => ({
    x: padding + index * stepX,
    // A flat history (max === min) is drawn through the middle.
    y: max === min ? height / 2 : padding + ((max - amount) / (max - min)) * innerHeight,
  }));
}
