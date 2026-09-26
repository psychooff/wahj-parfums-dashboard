# WAHJ PARFUMS — Analytics Dashboard

An interactive, two-channel analytics dashboard for WAHJ PARFUMS (local + online),
built from the business rules in the v1 strategy doc: 16-bottle batches, 14-day
maceration, ABC reorder triggers, 35 DH delivery absorbed on online packs and a
15% return provision.

Everything is live — change a date range, a channel, an ABC class or a business
rule and every KPI, chart, table and stock badge recalculates instantly.

---

## 👉 Put your own data in — the two folders you need

Both folders already exist in this repo, each with its own instructions:

| | Folder | What goes in it |
|---|---|---|
| 📊 | **[`public/data/`](public/data)** | Your CSVs: `orders.csv`, `production.csv`, `catalogue.csv`. They are in the repo right now with the correct header row — open one on GitHub, click the pencil, and paste your export underneath. |
| 🖼️ | **[`public/products/`](public/products)** | Product photos named after the SKU: `sauvage.jpg`, `khamrah.png`, `dior-bleu-de-chanel.webp`. Then run `npm run media:manifest`. |

Anything you add to those folders is picked up automatically the next time the
dashboard loads. Until you add real numbers, the dashboard runs on built-in sample
data — an empty placeholder file will **never** blank your screens.

You can also skip the repo entirely: open **Data & Photos** inside the dashboard and
drag your CSV or photos straight onto the page.

Filled examples of all three CSVs live in [`public/data-examples/`](public/data-examples)
so you can see the exact shape before you start.

```bash
npm install
npm run dev          # http://localhost:5173
npm run data:import  # check the CSVs you dropped in public/data/
```

---

## The screens

| Screen | What it answers |
|---|---|
| **Overview** | KPIs with trend indicators vs. the previous period, revenue by channel, channel mix donut, profit trend, auto-generated "what needs your attention" insights, top SKUs, cities, ABC performance, live order feed and a sortable/searchable/exportable order table |
| **Sales** | Basket size, bottles per order, return rate, order volume, a weekday × hour heatmap of when orders land, and the full order ledger with the two-channel cost columns |
| **Products & Packs** | SKU leaderboard, what to refill next, batch history per SKU, and pack economics — price, production, delivery absorbed, return provision, profit and margin per pack, with a price-vs-margin scatter and a pack builder view |
| **Stock & Maceration** | The screen that replaces the paper trackers: sellable vs. total stock, active maceration with countdowns ("ready in 4 days" / "ready — confirm now"), one-click *Move to stock*, a "+ New batch" form that calculates the ready date, reorder badges from your ABC triggers, and stock value at cost |
| **Finance** | Monthly P&L in your two-channel structure (local / online / combined with production, delivery, returns, net profit and margin), the 40/30/20/10 allocation split into DH, profit contribution by channel and a provisioned-vs-actual returns reality check |
| **Customers** | Repeat rate, revenue per customer, loyalty cycles (5 bottles → 6th free), dormant customers, top spenders, density by city and the buying-rhythm heatmap |
| **Data & Photos** | CSV import with preview and warnings, CSV exports, import history, and the product photo manager |
| **Business Rules** | Live sliders for the delivery fee, return provision, maceration days, ABC triggers and the profit allocation — move any of them and the whole dashboard re-prices |

## Business rules encoded in the code

| Rule from the v1 doc | Where it lives |
|---|---|
| 1 batch = 500 ml = 16 × 30 ml = 205 DH | `BASE_RECIPE` + `calculateBatchCost()` in `src/data/catalog.ts` |
| Maceration = 14 days, `ready_date` always calculated | `createBatch()` in `src/state/store.tsx`, `calculateMacerationReadyDate` rule applied on import |
| Sellable ≠ total stock | `getStockRows()` — only `IN_STOCK` counts for customers, alerts and stock value |
| Local: singles + 2-packs, no delivery, no return provision | order generation and `buildPnL()` in `src/lib/metrics.ts` |
| Online: packs only, 35 DH delivery, 15% return provision | same, plus a hard warning on import if a single bottle is sold online |
| ABC reorder triggers 8 / 5 / 3 with production suggestions | `RULES.reorderTriggers`, editable on *Business Rules* |
| Packs (Parfait, Couple, Gift Box, EID, Découverte) | `PACKS` in `src/data/catalog.ts`; revenue is attributed to each component SKU |
| Two-channel P&L, 40/30/20/10 allocation | `buildPnL()` + the Finance screen |
| Fire in Darkness brand system | `tailwind.config.js`, `src/index.css`, `src/lib/theme.ts` (chart palette per theme) |

## Sample data

Until you import your own files the dashboard runs on a deterministic simulation
(`src/data/generate.ts`, seed `20260926`): 18 months of history, ~2,400 orders,
~1,000 customers, ~380 production batches — with Ramadan/Eid/summer seasonality,
weekend uplifts, payday effects, FIFO stock consumption, 11% online return rate,
loyalty cycles, and production that occasionally runs late. It is generated from
your rules, not invented defaults: change `RULES` and the sample data changes with it.

## Stack and structure

Vite + React 18 + TypeScript + Tailwind + Recharts. No backend required — the
data layer is isolated so it can later be pointed at the Next.js + Prisma +
Supabase API from the strategy doc without touching a single component.

```
src/
  data/       catalog.ts (RULES, SKUs, packs) · generate.ts (simulation, stock, pack cost)
  lib/        types · metrics (KPIs, P&L, filters) · importer (CSV) · images (photos) · dates · theme
  state/      store.tsx (all filters + live calculations) · media.tsx
  charts/     RevenueCharts · BreakdownCharts · ProductCharts (shared tooltips + transitions)
  components/ Shell · FilterBar · KpiCard · DataTable · ChartCard · Insights · Thumb
  screens/    Overview · Sales · Products · Stock · Finance · Customers · DataStudio · Rules
scripts/      test-import · smoke · data-import · media-manifest · export-examples · sanity
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server on 0.0.0.0:5173 |
| `npm run build` / `npm run preview` | production build and preview |
| `npm test` | data engine + importer self-checks (84 assertions) |
| `npm run smoke` | renders every screen in jsdom and walks the filters |
| `npm run check` | TypeScript, no emit |
| `npm run data:import` | validate the CSVs sitting in `public/data/` |
| `npm run data:examples` | regenerate `public/data-examples/` |
| `npm run media:manifest` | rebuild the product-photo manifest |
| `npm run data:check` | print dataset statistics (orders, revenue, margin, stock health) |
