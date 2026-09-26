# Put your CSV files here

Anything in this folder is loaded by the dashboard automatically when it opens —
no button to press, no build step. Commit the files and the whole team sees them.

| File name | What it holds | Required? |
|---|---|---|
| `catalogue.csv` (or `products.csv`) | Your perfume list: name, brand, ABC class, oil cost, prices | optional |
| `production.csv` (or `batches.csv`) | Your production / maceration log | optional |
| `orders.csv` (or `ventes.csv`) | Your sales — local and online | yes, for real numbers |

Load order matters: catalogue → production → orders.

## Column names

Case, accents and spacing don't matter, French or English both work, column order is free.
Download ready-made templates from the dashboard: **Data & Photos → Download template**.

### orders.csv
`order_code, date, channel, status, customer_name, customer_phone, city, items, gross_revenue, delivery_fee, returned`

- `channel` — `LOCAL`/`boutique`/`local` or `ONLINE`/`colis`/`livraison`/`instagram`
- `items` — `2× Sauvage; 1× Khamrah` (or `1× Pack Parfait — Elle`, matched by pack name)
- One row per order **or** one row per item line, grouped by `order_code`
- `date` — `2026-09-24` or `24/09/2026`, both fine
- `gross_revenue` — `187` or `1 234,50 DH`, both fine

### production.csv
`perfume, production_date, bottles, status, ready_date, bottles_remaining, batch`

- `status` — `MACERATING` / `READY` / `IN_STOCK` / `DEPLETED`
- Leave `ready_date` empty and it is calculated as production date + 14 days

### catalogue.csv
`name, brand, gender, abc_class, oil_cost, bottles_per_batch, local_single_price, local_duo_price`

- Unit cost is always recalculated as (oil + alcohol + bottles + labels) ÷ bottles per batch

## Before committing

```bash
npm run data:import     # validates the files and prints what the dashboard will show
```

Anything that fails here would also fail in the browser, so it is the fastest check.
