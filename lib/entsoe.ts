/**
 * ENTSO-E Transparency Platform client for Belgian day-ahead electricity prices.
 *
 * Docs: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html
 * Belgium bidding zone EIC code: 10YBE----------2
 *
 * Requires an ENTSOE_API_KEY env var — register for free at
 * https://transparency.entsoe.eu (Account Settings -> Web Api Security Token).
 */

const ENTSOE_BASE_URL = 'https://web-api.tp.entsoe.eu/api';
const BELGIUM_DOMAIN = '10YBE----------2';

export interface PricePoint {
  /** ISO 8601 UTC start time of this interval */
  start: string;
  /** ISO 8601 UTC end time of this interval */
  end: string;
  /** EUR per MWh, as published by ENTSO-E */
  eurPerMwh: number;
  /** EUR cents per kWh, the unit people actually think in */
  centsPerKwh: number;
}

function formatEntsoeDate(d: Date): string {
  // ENTSO-E wants yyyyMMddHHmm, UTC
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes())
  );
}

/**
 * Very small, dependency-free XML text extractor for the specific
 * ENTSO-E day-ahead price document shape. We only need <Period> blocks
 * with a <resolution>, a <start>/<end> inside timeInterval, and a list
 * of <Point><position>/<price.amount> pairs.
 */
function parseEntsoeXml(xml: string): PricePoint[] {
  const points: PricePoint[] = [];

  const periodRegex = /<Period>([\s\S]*?)<\/Period>/g;
  let periodMatch: RegExpExecArray | null;

  while ((periodMatch = periodRegex.exec(xml)) !== null) {
    const periodXml = periodMatch[1];

    const startMatch = /<start>([^<]+)<\/start>/.exec(periodXml);
    const resolutionMatch = /<resolution>([^<]+)<\/resolution>/.exec(periodXml);
    if (!startMatch || !resolutionMatch) continue;

    const periodStart = new Date(startMatch[1]);
    const resolution = resolutionMatch[1]; // e.g. "PT60M" or "PT15M"
    const minutesMatch = /PT(\d+)M/.exec(resolution);
    const intervalMinutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 60;

    const pointRegex = /<Point>([\s\S]*?)<\/Point>/g;
    let pointMatch: RegExpExecArray | null;

    while ((pointMatch = pointRegex.exec(periodXml)) !== null) {
      const pointXml = pointMatch[1];
      const positionMatch = /<position>(\d+)<\/position>/.exec(pointXml);
      const priceMatch = /<price\.amount>([\d.\-]+)<\/price\.amount>/.exec(pointXml);
      if (!positionMatch || !priceMatch) continue;

      const position = parseInt(positionMatch[1], 10); // 1-indexed
      const eurPerMwh = parseFloat(priceMatch[1]);

      const start = new Date(periodStart.getTime() + (position - 1) * intervalMinutes * 60_000);
      const end = new Date(start.getTime() + intervalMinutes * 60_000);

      points.push({
        start: start.toISOString(),
        end: end.toISOString(),
        eurPerMwh,
        centsPerKwh: eurPerMwh / 10, // EUR/MWh -> cents/kWh
      });
    }
  }

  return points.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Fetches day-ahead prices for Belgium between periodStart and periodEnd (both Dates, UTC).
 * Throws if ENTSOE_API_KEY is missing or the API call fails.
 */
export async function fetchBelgiumDayAheadPrices(
  periodStart: Date,
  periodEnd: Date
): Promise<PricePoint[]> {
  const apiKey = process.env.ENTSOE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing ENTSOE_API_KEY env var. Register for free at https://transparency.entsoe.eu and add it to your .env.local / Vercel project settings.'
    );
  }

  const params = new URLSearchParams({
    securityToken: apiKey,
    documentType: 'A44', // Day-ahead prices
    in_Domain: BELGIUM_DOMAIN,
    out_Domain: BELGIUM_DOMAIN,
    periodStart: formatEntsoeDate(periodStart),
    periodEnd: formatEntsoeDate(periodEnd),
  });

  const res = await fetch(`${ENTSOE_BASE_URL}?${params.toString()}`, {
    // Day-ahead prices for a given day don't change once published; cache briefly.
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ENTSO-E API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const xml = await res.text();
  return parseEntsoeXml(xml);
}
