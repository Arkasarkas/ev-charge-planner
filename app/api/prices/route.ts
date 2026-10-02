import { NextResponse } from 'next/server';
import { fetchBelgiumDayAheadPrices } from '@/lib/entsoe';

export const dynamic = 'force-dynamic';

/**
 * GET /api/prices?from=2026-10-02&to=2026-10-04
 *
 * Returns day-ahead electricity prices for Belgium between the given
 * dates (UTC midnight to UTC midnight). Both params are optional;
 * defaults to "today through tomorrow".
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultTo = new Date(defaultFrom.getTime() + 2 * 24 * 60 * 60 * 1000);

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const periodStart = fromParam ? new Date(fromParam) : defaultFrom;
  const periodEnd = toParam ? new Date(toParam) : defaultTo;

  try {
    const points = await fetchBelgiumDayAheadPrices(periodStart, periodEnd);
    return NextResponse.json({ points });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching prices';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
