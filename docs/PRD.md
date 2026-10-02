# PRD — EV Charge Planner

## 1. Problem

Electricity prices in Belgium vary throughout the day (day-ahead market), and EV owners
currently have to manually check sites like Enfoapp to figure out when charging is
cheapest. This app surfaces that automatically, so users don't have to think about it.

## 2. Goal (v1)

A free, ad-supported web app that:
- Shows today's and tomorrow's Belgian day-ahead electricity prices as an at-a-glance,
  color-coded (green → red) bar chart, per interval (15-min or hourly depending on data).
- Automatically finds the cheapest charging window each day.
- Flags a window as a "good deal" when it's notably cheaper (default: 20%+) than the
  trailing 7-day average — not just showing raw numbers.
- Works well as a quick phone check (web-first, deployed on Vercel).

## 3. Non-goals (v1)

Explicitly deferred to later versions — see `ROADMAP.md`:
- Trip/departure-deadline planning ("I need 40% more charge by 4pm tomorrow")
- Direct car integration (Lynk & Co or others)
- Push notifications
- E-Flux (home charging station) cost layer
- Multi-country support beyond Belgium
- Native mobile app (React Native / Expo / TypeScript, Android-first)
- User accounts / custom thresholds

## 4. Users

- Primary: the author's father, a Lynk & Co EV owner in Belgium who wants to know when
  to charge without checking prices manually.
- Secondary (future): any EV owner in Belgium, then other European countries.

## 5. Data source

[ENTSO-E Transparency Platform](https://transparency.entsoe.eu) — free, EU-mandated
(Regulation 543/2013) day-ahead electricity price API, covering Belgium and the rest of
Europe. Commercial use is allowed; attribution to ENTSO-E is required. Requires a free
API key (`ENTSOE_API_KEY`).

## 6. Core logic

- **Rolling average**: mean price (cents/kWh) over the trailing 7 days.
- **Good deal threshold**: a charging window qualifies as a "good deal" when its average
  price is ≥20% below the rolling average. Configurable later; 20% is the default.
- **Cheapest window**: the cheapest contiguous block of intervals (default: 1 hour's
  worth of intervals, i.e. 4×15-min or 1×60-min depending on data resolution).

## 7. Monetization

Ad-supported (e.g. a small banner, ~10% of screen height, non-intrusive). Free to use.

## 8. Success criteria (v1)

- Dashboard loads today + tomorrow's prices correctly for Belgium.
- Cheapest window is correctly identified and visually distinct.
- App is reachable on a phone browser via a Vercel URL.
- No native app, no accounts, no notifications required to call v1 "done."

## 9. Open questions

- E-Flux subscription + "payback clause" details — pending from the user, needed to
  build the real cost-per-charge calculation (energy price + station overhead).
- Exact granularity of ENTSO-E data for Belgium (hourly vs 15-min) — code currently
  adapts automatically based on what the API returns.
