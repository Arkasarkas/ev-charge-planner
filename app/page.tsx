'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PricePoint } from '@/lib/entsoe';
import { computeStats, priceToColor, DEFAULT_GOOD_DEAL_THRESHOLD } from '@/lib/stats';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Brussels',
  });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Brussels',
  });
}

export default function Home() {
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/prices')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load prices');
        setPoints(data.points);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(() => {
    const grouped = new Map<string, PricePoint[]>();
    for (const p of points) {
      const dayKey = formatDay(p.start);
      if (!grouped.has(dayKey)) grouped.set(dayKey, []);
      grouped.get(dayKey)!.push(p);
    }
    return Array.from(grouped.entries());
  }, [points]);

  // 4 intervals per hour assuming 15-min data; falls back gracefully for hourly.
  const windowIntervals = useMemo(() => {
    if (points.length < 2) return 4;
    const minutesPerInterval =
      (new Date(points[0].end).getTime() - new Date(points[0].start).getTime()) / 60000;
    return Math.max(1, Math.round(60 / minutesPerInterval));
  }, [points]);

  const stats = useMemo(
    () => computeStats(points, points, windowIntervals, DEFAULT_GOOD_DEAL_THRESHOLD),
    [points, windowIntervals]
  );

  const allPrices = points.map((p) => p.centsPerKwh);
  const min = allPrices.length ? Math.min(...allPrices) : 0;
  const max = allPrices.length ? Math.max(...allPrices) : 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">EV Charge Planner</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Day-ahead electricity prices for Belgium, from ENTSO-E.
      </p>

      {loading && <p className="mt-8 text-neutral-400">Loading today&apos;s prices…</p>}

      {error && (
        <div className="mt-8 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          <p className="font-medium">Couldn&apos;t load prices.</p>
          <p className="mt-1 text-red-400">{error}</p>
          <p className="mt-2 text-red-400/80">
            Make sure <code className="rounded bg-black/40 px-1 py-0.5">ENTSOE_API_KEY</code> is
            set in your environment.
          </p>
        </div>
      )}

      {!loading && !error && stats.bestWindow && (
        <div
          className={`mt-8 rounded-lg border p-4 ${
            stats.isGoodDeal
              ? 'border-green-800 bg-green-950/40'
              : 'border-neutral-800 bg-neutral-900'
          }`}
        >
          <p className="text-sm font-medium">
            {stats.isGoodDeal ? '⚡ Good charging window' : 'Cheapest window right now'}
          </p>
          <p className="mt-1 text-lg">
            {formatTime(stats.bestWindow.start)} – {formatTime(stats.bestWindow.end)}
            <span className="ml-2 text-neutral-400 text-base">
              ~{stats.bestWindow.avgCentsPerKwh.toFixed(1)} c/kWh
            </span>
          </p>
          {stats.isGoodDeal && (
            <p className="mt-1 text-sm text-green-400">
              {Math.round(stats.percentBelowAverage * 100)}% cheaper than the recent average (
              {stats.rollingAverageCentsPerKwh.toFixed(1)} c/kWh)
            </p>
          )}
        </div>
      )}

      {!loading &&
        !error &&
        days.map(([day, dayPoints]) => (
          <section key={day} className="mt-8">
            <h2 className="text-sm font-medium text-neutral-300">{day}</h2>
            <div className="mt-2 flex h-32 items-end gap-[1px] rounded-lg bg-neutral-900 p-2">
              {dayPoints.map((p) => (
                <div
                  key={p.start}
                  title={`${formatTime(p.start)} — ${p.centsPerKwh.toFixed(1)} c/kWh`}
                  className="flex-1 rounded-sm transition-opacity hover:opacity-80"
                  style={{
                    height: `${Math.max(4, ((p.centsPerKwh - min) / (max - min || 1)) * 100)}%`,
                    backgroundColor: priceToColor(p.centsPerKwh, min, max),
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-neutral-500">
              <span>{formatTime(dayPoints[0].start)}</span>
              <span>{formatTime(dayPoints[dayPoints.length - 1].end)}</span>
            </div>
          </section>
        ))}
    </main>
  );
}
