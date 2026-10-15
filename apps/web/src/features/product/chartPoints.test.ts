import { describe, expect, it } from '@jest/globals';
import { buildChartPoints } from './chartPoints';

describe('buildChartPoints', () => {
  it('returns nothing for an empty history', () => {
    expect(buildChartPoints([], 100, 50, 10)).toEqual([]);
  });

  it('puts the lowest price at the bottom and the highest at the top', () => {
    expect(buildChartPoints([100, 200], 100, 50, 10)).toEqual([
      { x: 10, y: 40 },
      { x: 90, y: 10 },
    ]);
  });

  it('draws a flat history through the middle', () => {
    expect(buildChartPoints([5, 5, 5], 100, 50, 10).map((point) => point.y)).toEqual([25, 25, 25]);
  });
});
