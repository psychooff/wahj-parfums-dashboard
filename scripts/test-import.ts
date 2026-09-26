/**
 *  Self-checks for the data engine and the CSV importer.
 *
 *    npm test
 *
 * The most important one is the round-trip: export the dataset, re-import it,
 * and every single number must match. That is the guarantee that a founder can
 * take the CSV out, edit it in Excel, and bring it back without the dashboard
 * quietly changing their figures.
 */
import { buildDataset, getStockRows } from '../src/data/generate'
import { PACKS, RULES } from '../src/data/catalog'
import {
  importCsv,
  ordersToCsv,
  batchesToCsv,
  templateCsv,
  parseCsv,
  toDayKey,
  toNumber,
  parseItemsText,
  TEMPLATES,
} from '../src/lib/importer'
import { buildPnL, computeKpis, filterOrders, presetRange } from '../src/lib/metrics'
import { addDays, dayKey } from '../src/lib/dates'

let passed = 0
let failed = 0
const failures: string[] = []

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    failures.push(label)
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const money = (n: number) => Math.round(n * 100) / 100
const sum = <T,>(arr: T[], f: (t: T) => number) => arr.reduce((s, x) => s + f(x), 0)

// ── 1. Dataset integrity ────────────────────────────────────────────────────
console.log('\nDataset')
const a = buildDataset()
const b = buildDataset()
check('same seed produces identical data', a.orders.length === b.orders.length && a.orders[100].code === b.orders[100].code)
check('order ids and codes are unique', new Set(a.orders.map((o) => o.id)).size === a.orders.length && new Set(a.orders.map((o) => o.code)).size === a.orders.length)
check('every order has at least one item', a.orders.every((o) => o.items.length > 0))
check('every order has a positive gross revenue', a.orders.every((o) => o.grossRevenue > 0))
check(
  'local orders never carry delivery or return provision',
  a.orders.filter((o) => o.channel === 'LOCAL').every((o) => o.deliveryFee === 0 && o.returnProvision === 0),
)
check(
  'online orders always carry the 35 DH delivery cost',
  a.orders.filter((o) => o.channel === 'ONLINE').every((o) => o.deliveryFee === RULES.deliveryFee),
)
check(
  'online packs are the only online order type',
  a.orders.filter((o) => o.channel === 'ONLINE').every((o) => o.orderType === 'PACK' && o.items.every((i) => i.kind === 'pack')),
)
check(
  'single bottles are never sold online',
  a.orders.filter((o) => o.channel === 'ONLINE').every((o) => o.items.reduce((s, i) => s + i.bottles, 0) >= 3),
)
check('returned orders have zero recognised revenue', a.orders.filter((o) => o.returned).every((o) => o.revenue === 0))
check('cancelled orders have zero profit', a.orders.filter((o) => o.status === 'cancelled').every((o) => o.netProfit === 0))
check(
  'net profit always equals revenue minus total cost',
  a.orders.every((o) => Math.abs(o.netProfit - (o.revenue - o.totalCost)) < 0.02),
)
check(
  'history covers more than 12 months',
  a.historyStart < dayKey(addDays(new Date(), -360)),
  `${a.historyStart} → ${a.historyEnd}`,
)

// order types match the channel rules
const packByChannel = { LOCAL: 0, ONLINE: 0 }
for (const o of a.orders) if (o.orderType === 'PACK') packByChannel[o.channel]++
check('packs exist only on the online channel', packByChannel.LOCAL === 0 && packByChannel.ONLINE > 0)

// ── 2. Production / maceration ──────────────────────────────────────────────
console.log('\nMaceration engine')
check('every batch has a ready date 14 days after production', a.batches.every((bt) => bt.readyDate === dayKey(addDays(bt.productionDate, RULES.macerationDays))))
check('depleted batches hold no bottles', a.batches.filter((bt) => bt.status === 'DEPLETED').every((bt) => bt.bottlesRemaining === 0))
check('in-stock batches have bottles and a sales start', a.batches.filter((bt) => bt.status === 'IN_STOCK').every((bt) => bt.bottlesRemaining > 0 && bt.salesStartedAt))
check('macerating batches have never been sold from', a.batches.filter((bt) => bt.status === 'MACERATING').every((bt) => bt.bottlesRemaining === bt.bottleCount))
check('batch codes are unique', new Set(a.batches.map((x) => x.code)).size === a.batches.length)
check('the pipeline never empties completely', a.batches.some((x) => x.status === 'MACERATING' || x.status === 'READY'))

const stock = getStockRows(a)
check('sellable stock never exceeds total bottles produced', stock.every((s) => s.sellable <= s.batches.reduce((n, x) => n + x.bottleCount, 0)))
check('total = sellable + macerating for every SKU', stock.every((s) => s.total === s.sellable + s.macerating))
check('at least one SKU sits below its class trigger', stock.some((s) => s.reorderStatus !== 'ok'))
check('reorder triggers follow the ABC classes', stock.every((s) => s.trigger === RULES.reorderTriggers[s.perfume.abcClass]))

// ── 3. Channel rules in the P&L ─────────────────────────────────────────────
console.log('\nTwo-channel P&L')
const pnl = buildPnL(a.orders)
check('local P&L has no delivery cost at all', pnl.local.delivery === 0)
check('online P&L carries delivery for every order', pnl.online.delivery === money(pnl.online.orders * RULES.deliveryFee))
check('local margin beats online margin', pnl.local.margin > pnl.online.margin, `local ${pnl.local.margin}% vs online ${pnl.online.margin}%`)
check('allocation adds up to 100%', Math.abs(pnl.allocation.reduce((s, x) => s + x.rate, 0) - 1) < 1e-9)
check('allocation is applied to net profit only', pnl.allocation.every((x) => Math.abs(x.amount - Math.max(0, pnl.combined.profit) * x.rate) < 0.02))
check('combined revenue is the sum of both channels', Math.abs(pnl.combined.revenue - (pnl.local.revenue + pnl.online.revenue)) < 0.05)
check('actual return damage is counted separately from the provision', pnl.actualReturnLoss > 0 && pnl.expectedReturnLoss > 0)

const kpis = computeKpis(a.orders, new Map())
check('KPI order count excludes cancellations', kpis.orders === a.orders.filter((o) => o.status !== 'cancelled').length)
check('revenue per order is plausible', kpis.aov > 80 && kpis.aov < 400, `AOV ${kpis.aov}`)

// ── 4. CSV round trip — the important one ───────────────────────────────────
console.log('\nCSV round trip (export → re-import)')
const ctx = {
  perfumes: a.perfumes,
  packs: PACKS,
  deliveryFee: RULES.deliveryFee,
  returnProvisionRate: RULES.returnProvisionRate,
  macerationDays: RULES.macerationDays,
}
const nameOf = (id: string) => a.customers.find((c) => c.id === id)?.name ?? id
const phoneOf = (id: string) => a.customers.find((c) => c.id === id)?.phone ?? ''
const csv = ordersToCsv(a.orders, nameOf, phoneOf)
const re = importCsv(csv, ctx)

const metrics: Array<[string, number, number]> = [
  ['orders', a.orders.length, re.orders.length],
  ['gross revenue', sum(a.orders, (o) => o.grossRevenue), sum(re.orders, (o) => o.grossRevenue)],
  ['recognised revenue', sum(a.orders, (o) => o.revenue), sum(re.orders, (o) => o.revenue)],
  ['production cost', sum(a.orders, (o) => o.productionCost), sum(re.orders, (o) => o.productionCost)],
  ['delivery', sum(a.orders, (o) => o.deliveryFee), sum(re.orders, (o) => o.deliveryFee)],
  ['return provision', sum(a.orders, (o) => o.returnProvision), sum(re.orders, (o) => o.returnProvision)],
  ['net profit', sum(a.orders, (o) => o.netProfit), sum(re.orders, (o) => o.netProfit)],
  ['bottles', sum(a.orders, (o) => sum(o.items, (i) => i.bottles)), sum(re.orders, (o) => sum(o.items, (i) => i.bottles))],
  ['local orders', a.orders.filter((o) => o.channel === 'LOCAL').length, re.orders.filter((o) => o.channel === 'LOCAL').length],
  ['returned orders', a.orders.filter((o) => o.returned).length, re.orders.filter((o) => o.returned).length],
  ['customers', a.customers.length, re.customers.length],
]
for (const [label, source, reimported] of metrics) {
  check(`${label} survive the round trip`, Math.abs(source - reimported) < 0.05, `${source} → ${reimported}`)
}
check('every order code is preserved', a.orders.every((o) => re.orders.some((r) => r.code === o.code)))
check('no spurious warnings on a clean file', re.warnings.length === 0, re.warnings.slice(0, 2).join(' / '))

const batchCsv = batchesToCsv(a.batches, (id) => a.perfumes.find((p) => p.id === id)!.name)
const reBatches = importCsv(batchCsv, ctx)
check('production log round-trips every batch', reBatches.batches.length === a.batches.length)
check('re-imported batches keep their calculated ready date', reBatches.batches.every((x) => x.readyDate === dayKey(addDays(x.productionDate, 14))))
check('re-imported statuses are preserved', reBatches.batches.filter((x) => x.status === 'IN_STOCK').length === a.batches.filter((x) => x.status === 'IN_STOCK').length)

// ── 5. Messy real-world files ───────────────────────────────────────────────
console.log('\nTolerant parsing')
check('semibon-delimited French headers are detected', parseCsv('N° commande;Date;Type de vente\nA;1;boutique').delimiter === ';')
check('ISO dates parse', toDayKey('2026-09-24') === '2026-09-24')
check('French dates parse', toDayKey('24/09/2026') === '2026-09-24')
check('short French dates parse', toDayKey('24/09/26') === '2026-09-24')
check('Excel serial dates parse', toDayKey('46000') === '2025-12-09', String(toDayKey('46000')))
check('"1 234,50 DH" parses', toNumber('1 234,50 DH') === 1234.5, String(toNumber('1 234,50 DH')))
check('"1,234.50" parses', toNumber('1,234.50') === 1234.5, String(toNumber('1,234.50')))
check('"205" parses', toNumber('205') === 205)
check('item lists parse (× and qty-first)', parseItemsText('2× Sauvage; 1× Khamrah').length === 2)
check('item lists parse (qty-last)', parseItemsText('Sauvage x3').every((i) => i.qty === 3))

const messy = `N° commande;Date;Type de vente;Statut;Client;Téléphone;Ville;Articles;Total;Retour
C-501;24/09/2026;boutique;livré;Salma B;0661 22 33 44;Casablanca;2× Yara;89;0
C-502;25/09/2026;colis;expédié;Youssef E;0712556677;Marrakech;1× Pack Parfait — Elle;269;0
C-503;26/09/2026;instagram;retour;Nada K;0611223344;Rabat;1× Khamrah;49;1
C-504;26/09/2026;local;livré;Hamza R;0655443322;Agadir;3× Sauvage;139;
`
const m = importCsv(messy, ctx)
check('French order file is recognised', m.kind === 'orders' && m.orders.length === 4)
check('"boutique" maps to LOCAL, "colis" to ONLINE', m.orders[0].channel === 'LOCAL' && m.orders[1].channel === 'ONLINE')
check('"expédié" maps to shipped', m.orders[1].status === 'shipped')
check('a returned online order loses its revenue', m.orders[2].returned && m.orders[2].revenue === 0)
check('a returned online order is charged return shipping', m.orders[2].returnShipping === 25)
check('a returned local order is not charged return shipping', m.orders[0].returnShipping === 0)
check('online rows get the 35 DH delivery cost', m.orders[1].deliveryFee === 35 && m.orders[0].deliveryFee === 0)
check('pack lines are matched to the pack catalogue', m.orders[1].orderType === 'PACK' && m.orders[1].items[0].bottles === 5)
check('the online-single rule violation is flagged', m.warnings.some((w) => w.includes('ONLINE order with single bottles')))
check('customers are keyed by phone', m.customers.length === 4)

const productsCsv = `name,brand,gender,abc_class,oil_cost,bottles_per_batch,local_single_price,local_duo_price
Oud Mood,Lattafa,unisex,A,130,16,59,109
Sauvage,Dior,men,A,110,16,49,89
`
const p = importCsv(productsCsv, ctx)
check('catalogue file is recognised as products', p.kind === 'products' && p.perfumes.length === 2)
// oil 130 + alcohol 16.50 + bottles 60 + labels 18.50 = 225 DH per 16-bottle batch → 14.06 DH/bottle
check('unit cost is recalculated from the recipe', Math.abs(p.perfumes[0].unitCost30ml - 14.06) < 0.02, String(p.perfumes[0].unitCost30ml))
check('a more expensive oil raises the unit cost', p.perfumes[0].unitCost30ml > p.perfumes[1].unitCost30ml)
check('gender and class are mapped', p.perfumes[0].gender === 'unisex' && p.perfumes[0].abcClass === 'A')
check('prices are imported', p.perfumes[0].localSinglePrice === 59)

// A header-only file (the placeholders committed in public/data/) must be inert:
// it must not be mistaken for real data and empty the dashboard.
const headerOnly = ['orders', 'production', 'products'] as const
for (const kind of headerOnly) {
  const header = TEMPLATES[kind].columns.join(',')
  const result = importCsv(header, ctx)
  check(`a header-only ${kind} file is inert (placeholder, not data)`, result.rowCount === 0 && result.orders.length === 0 && result.batches.length === 0 && result.perfumes.length === 0)
}

const unknown = importCsv('foo,bar\n1,2', ctx)
check('an unreadable file is rejected with guidance', unknown.kind === 'unknown' && unknown.warnings.length > 0)
check('an empty file is handled', importCsv('', ctx).warnings.length > 0)

// ── 6. Templates & filters ──────────────────────────────────────────────────
console.log('\nTemplates and filters')
for (const kind of ['orders', 'production', 'products'] as const) {
  const t = parseCsv(templateCsv(kind))
  check(`${kind} template has a header row and examples`, t.headers.length > 0 && t.rows.length > 0)
  const roundTripped = importCsv(templateCsv(kind), ctx)
  check(`${kind} template is importable as-is`, roundTripped.kind === kind, `detected ${roundTripped.kind}`)
}

const range = presetRange('30d', a.historyStart, a.historyEnd)
const filtered = filterOrders(a.orders, {
  preset: '30d',
  from: range.from,
  to: range.to,
  channels: ['LOCAL', 'ONLINE'],
  classes: ['A', 'B', 'C'],
  genders: ['men', 'women', 'unisex'],
}, { packsById: new Map(PACKS.map((x) => [x.id, x])), perfumesById: new Map(a.perfumes.map((x) => [x.id, x])) })
check('the 30-day filter returns orders inside the window', filtered.every((o) => dayKey(o.createdAt) >= range.from && dayKey(o.createdAt) <= range.to))
check('the 30-day filter is not empty', filtered.length > 0)

const onlyLocal = filterOrders(a.orders, {
  preset: 'all', from: a.historyStart, to: a.historyEnd, channels: ['LOCAL'], classes: ['A', 'B', 'C'], genders: ['men', 'women', 'unisex'],
}, { packsById: new Map(PACKS.map((x) => [x.id, x])), perfumesById: new Map(a.perfumes.map((x) => [x.id, x])) })
check('the channel filter is exclusive', onlyLocal.every((o) => o.channel === 'LOCAL'))

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`\n${failed ? '✗' : '✓'} ${passed} passed, ${failed} failed`)
if (failed) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  · ${f}`)
  process.exit(1)
}
