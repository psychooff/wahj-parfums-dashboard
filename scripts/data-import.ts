/**
 * Validates the CSVs committed in public/data/ before they ever reach the browser.
 *
 *   npm run data:import
 *
 * It runs the exact same importer the dashboard uses, so anything that passes
 * here will load cleanly when someone opens the app.
 */
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { importCsv } from '../src/lib/importer'
import { PACKS, PERFUMES, RULES } from '../src/data/catalog'
import { dayKey } from '../src/lib/dates'

const dataDir = path.resolve('public', 'data')
const known = ['catalogue.csv', 'products.csv', 'production.csv', 'batches.csv', 'orders.csv', 'ventes.csv']

const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} DH`

async function main() {
  if (!existsSync(dataDir)) {
    console.log('No public/data/ folder yet — nothing to validate. Create it and drop your CSVs in.')
    return
  }
  const files = (await readdir(dataDir)).filter((f) => f.toLowerCase().endsWith('.csv'))
  if (!files.length) {
    console.log('public/data/ exists but has no .csv files.')
    console.log('Expected names (any of these):', known.join(', '))
    return
  }

  const ctx = {
    perfumes: PERFUMES,
    packs: PACKS,
    deliveryFee: RULES.deliveryFee,
    returnProvisionRate: RULES.returnProvisionRate,
    macerationDays: RULES.macerationDays,
  }

  let failures = 0
  for (const file of files.sort((a, b) => known.indexOf(a) - known.indexOf(b))) {
    const text = await readFile(path.join(dataDir, file), 'utf8')
    const preview = importCsv(text, ctx)
    const icon = preview.kind === 'unknown' || !preview.rowCount ? '✗' : preview.warnings.length ? '!' : '✓'
    if (preview.kind === 'unknown') failures++

    console.log(`\n${icon} ${file} → detected as ${preview.kind.toUpperCase()} (${preview.rowCount} rows)`)
    for (const line of preview.info) console.log(`   ✓ ${line}`)
    for (const line of preview.warnings.slice(0, 10)) console.log(`   ! ${line}`)
    if (preview.warnings.length > 10) console.log(`   ! …and ${preview.warnings.length - 10} more warnings`)

    if (preview.kind === 'orders' && preview.orders.length) {
      const revenue = preview.orders.reduce((s, o) => s + o.revenue, 0)
      const profit = preview.orders.reduce((s, o) => s + o.netProfit, 0)
      const local = preview.orders.filter((o) => o.channel === 'LOCAL')
      const online = preview.orders.filter((o) => o.channel === 'ONLINE')
      const dates = preview.orders.map((o) => o.createdAt.slice(0, 10)).sort()
      console.log(`   → revenue ${money(revenue)} · profit ${money(profit)} · margin ${revenue ? ((profit / revenue) * 100).toFixed(1) : '0'}%`)
      console.log(`   → ${local.length} local orders (${money(local.reduce((s, o) => s + o.revenue, 0))}) · ${online.length} online orders (${money(online.reduce((s, o) => s + o.revenue, 0))})`)
      console.log(`   → ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} days, generated ${dayKey(new Date())})`)
    }
    if (preview.kind === 'production' && preview.batches.length) {
      const sellable = preview.batches.filter((b) => b.status === 'IN_STOCK').reduce((s, b) => s + b.bottlesRemaining, 0)
      const cooking = preview.batches.filter((b) => b.status === 'MACERATING' || b.status === 'READY').reduce((s, b) => s + b.bottlesRemaining, 0)
      console.log(`   → ${sellable} sellable bottles · ${cooking} still macerating`)
    }
    if (preview.kind === 'products' && preview.perfumes.length) {
      const costs = preview.perfumes.map((p) => p.unitCost30ml)
      console.log(`   → unit cost range ${Math.min(...costs).toFixed(2)} → ${Math.max(...costs).toFixed(2)} DH per 30ml`)
    }
  }

  console.log(
    failures
      ? `\n${failures} file(s) could not be recognised — check the header row against the templates in the dashboard (Data & Photos screen).`
      : '\nAll files look good. Open the dashboard and they load automatically, or import them by hand on the Data & Photos screen.',
  )
}

main().catch((err) => {
  console.error('Validation failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
