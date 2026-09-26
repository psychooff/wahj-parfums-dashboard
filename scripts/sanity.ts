import { buildDataset, getStockRows } from '../src/data/generate'
import { buildPnL, computeKpis, monthlyPnL } from '../src/lib/metrics'
import { dayKey } from '../src/lib/dates'


const t0 = Date.now()
const ds = buildDataset()
const ms = Date.now() - t0

const perfumesById = new Map(ds.perfumes.map((p) => [p.id, p]))
const packsById = new Map(ds.packs.map((p) => [p.id, p]))
void packsById

const firstOrder = new Map<string, string>()
for (const o of ds.orders) {
  const k = dayKey(o.createdAt)
  if (!firstOrder.has(o.customerId)) firstOrder.set(o.customerId, k)
}

const last30 = ds.orders.filter((o) => dayKey(o.createdAt) >= dayKey(new Date(Date.now() - 29 * 86400000)))
const kpis = computeKpis(last30, firstOrder)
const pnl = buildPnL(last30)

console.log(`generated in ${ms}ms`)
console.log(`history      : ${ds.historyStart} → ${ds.historyEnd}`)
console.log(`orders       : ${ds.orders.length}  batches: ${ds.batches.length}  customers: ${ds.customers.length}  alerts(open): ${ds.alerts.filter((a) => a.status === 'open').length}`)
console.log(`last 30 days : ${JSON.stringify(kpis, null, 1)}`)
console.log(`P&L 30d      : local=${JSON.stringify(pnl.local)}`)
console.log(`               online=${JSON.stringify(pnl.online)}`)
console.log(`               combined rev=${pnl.combined.revenue} profit=${pnl.combined.profit} margin=${pnl.combined.margin}%`)

const months = monthlyPnL(ds.orders)
console.log('\nmonthly revenue / profit (all channels):')
for (const m of months) {
  console.log(`  ${m.month}  rev ${String(Math.round(m.combined.revenue)).padStart(7)}  profit ${String(Math.round(m.combined.profit)).padStart(7)}  local ${String(Math.round(m.local.revenue)).padStart(6)} online ${String(Math.round(m.online.revenue)).padStart(6)}  orders ${m.combined.orders}`)
}

const stock = getStockRows(ds)
const urgent = stock.filter((s) => s.reorderStatus !== 'ok')
console.log(`\nstock: ${stock.length} SKUs — ok ${stock.length - urgent.length} / watch ${urgent.filter((u) => u.reorderStatus === 'reorder').length} / urgent ${urgent.filter((u) => u.reorderStatus === 'urgent').length}`)
console.log(`unit cost range: ${Math.min(...ds.perfumes.map((p) => p.unitCost30ml))} → ${Math.max(...ds.perfumes.map((p) => p.unitCost30ml))} DH`)
console.log(`status mix   :`, ds.orders.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {}))
console.log(`channel mix  :`, ds.orders.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.channel]: (acc[o.channel] ?? 0) + 1 }), {}))
console.log(`perfume check: ${perfumesById.get('sauvage')?.name} sellable=${stock.find((s) => s.perfume.id === 'sauvage')?.sellable}`)

console.log(`\nbatch status :`, ds.batches.reduce<Record<string,number>>((a,b)=>({...a,[b.status]:(a[b.status]??0)+1}),{}))
console.log(`macerating bottles:`, ds.batches.filter(b=>b.status==='MACERATING'||b.status==='READY').reduce((s,b)=>s+b.bottlesRemaining,0))
console.log(`ready to confirm  :`, ds.batches.filter(b=>b.status==='READY').map(b=>`${b.code}/${b.perfumeId}/${b.readyDate}`).slice(0,6))
console.log(`top perfumes      :`, (await import('../src/lib/metrics')).perfumeStats(ds.orders,{packsById,perfumesById}).slice(0,5).map(s=>`${s.perfume.name} ${Math.round(s.revenue)}DH/${s.bottles}bt`).join(' | '))
