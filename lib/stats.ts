import { PricePoint } from './entsoe';

export interface ChargingWindow {
  start: string;
  end: string;
  /** Number of consecutive intervals in this window */
  intervalCount: number;
  avgCentsPerKwh: number;
}

export interface PriceStats {
  points: PricePoint[];
  /** Rolling average over the trailing N days, in cents/kWh */
  rollingAverageCentsPerKwh: number;
  /** The single cheapest interval */
  cheapestPoint: PricePoint | null;
  /** The most expensive interval */
  mostExpensivePoint: PricePoint | null;
  /** Cheapest contiguous window of the requested length that beats the threshold */
  bestWindow: ChargingWindow | null;
  /** Whether bestWindow qualifies as a "good deal" vs the rolling average */
  isGoodDeal: boolean;
  /** How far below the rolling average the best window is, as a fraction (0.2 = 20% cheaper) */
  percentBelowAverage: number;
}

/**
 * Computes a simple rolling average from historical price points.
 * Pass in the trailing N days of points (e.g. the last 7 days).
 */
export function computeRollingAverage(historicalPoints: PricePoint[]): number {
  if (historicalPoints.length === 0) return 0;
  const sum = historicalPoints.reduce((acc, p) => acc + p.centsPerKwh, 0);
  return sum / historicalPoints.length;
}

/**
 * Finds the cheapest contiguous window of `windowIntervals` intervals
 * within `points` (points must be sorted ascending by start time and
 * drawn from a single contiguous day so there are no gaps).
 */
export function findCheapestWindow(
  points: PricePoint[],
  windowIntervals: number
): ChargingWindow | null {
  if (points.length < windowIntervals || windowIntervals <= 0) return null;

  let bestSum = Infinity;
  let bestStartIdx = -1;

  let currentSum = 0;
  for (let i = 0; i < points.length; i++) {
    currentSum += points[i].centsPerKwh;
    if (i >= windowIntervals) {
      currentSum -= points[i - windowIntervals].centsPerKwh;
    }
    if (i >= windowIntervals - 1 && currentSum < bestSum) {
      bestSum = currentSum;
      bestStartIdx = i - windowIntervals + 1;
    }
  }

  if (bestStartIdx === -1) return null;

  const windowPoints = points.slice(bestStartIdx, bestStartIdx + windowIntervals);
  return {
    start: windowPoints[0].start,
    end: windowPoints[windowPoints.length - 1].end,
    intervalCount: windowIntervals,
    avgCentsPerKwh: bestSum / windowIntervals,
  };
}

/**
 * Default "good deal" threshold: a window counts as notably cheap when
 * it's at least this fraction below the rolling average (20% = 0.2).
 * Matches the agreed default; users can override this later via settings.
 */
export const DEFAULT_GOOD_DEAL_THRESHOLD = 0.2;

export function computeStats(
  points: PricePoint[],
  historicalPoints: PricePoint[],
  windowIntervals: number,
  goodDealThreshold: number = DEFAULT_GOOD_DEAL_THRESHOLD
): PriceStats {
  const rollingAverageCentsPerKwh = computeRollingAverage(
    historicalPoints.length > 0 ? historicalPoints : points
  );

  const sorted = [...points].sort((a, b) => a.centsPerKwh - b.centsPerKwh);
  const cheapestPoint = sorted[0] ?? null;
  const mostExpensivePoint = sorted[sorted.length - 1] ?? null;

  const bestWindow = findCheapestWindow(points, windowIntervals);

  let percentBelowAverage = 0;
  let isGoodDeal = false;
  if (bestWindow && rollingAverageCentsPerKwh > 0) {
    percentBelowAverage =
      (rollingAverageCentsPerKwh - bestWindow.avgCentsPerKwh) / rollingAverageCentsPerKwh;
    isGoodDeal = percentBelowAverage >= goodDealThreshold;
  }

  return {
    points,
    rollingAverageCentsPerKwh,
    cheapestPoint,
    mostExpensivePoint,
    bestWindow,
    isGoodDeal,
    percentBelowAverage,
  };
}

/**
 * Maps a price (relative to the day's min/max) to a green -> yellow -> red
 * color, for the at-a-glance bar chart. Returns a Tailwind-friendly hex.
 */
export function priceToColor(price: number, min: number, max: number): string {
  if (max === min) return '#22c55e'; // flat day, show green
  const t = Math.min(1, Math.max(0, (price - min) / (max - min)));

  // green (34,197,94) -> yellow (234,179,8) -> red (239,68,68)
  const stops = [
    { t: 0, c: [34, 197, 94] },
    { t: 0.5, c: [234, 179, 8] },
    { t: 1, c: [239, 68, 68] },
  ];

  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const localT = upper.t === lower.t ? 0 : (t - lower.t) / (upper.t - lower.t);
  const rgb = lower.c.map((c, i) => Math.round(c + (upper.c[i] - c) * localT));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
