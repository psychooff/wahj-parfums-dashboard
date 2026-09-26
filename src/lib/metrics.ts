import type { ABCClass, Channel, Filters, Order, Pack, Perfume, ProductionBatch, RangePreset } from './types'
import { RULES } from '../data/catalog'
import { addDays, dayKey, daysBetween, monthKey, parseDay, startOfDay } from './dates'

const round2 = (n: number) => Math.round(n * 100) / 100
const round1 = (n: number) => Math.round(n * 10) / 10

export const isCounted = (o: Order) => o.status !== 'cancelled'
export const isPaid = (o: Order) => o.status !== 'cancelled' && o.status !== 'returned'

export function orderBottles(o: Order) {
  return o.items.reduce((s, it) => s + it.bottles, 0)
}

/** Perfume ids touched by an order (a pack touches every component). */
export function orderPerfumeIds(o: Order, packsById: Map<string, Pack>): string[] {
  const ids = new Set<string>()
  for (const it of o.items) {
    if (it.kind === 'perfume') ids.add(it.refId)
    else {
      const pack = packsById.get(it.refId)
      pack?.items.forEach((c) => ids.add(c.perfumeId))
    }
  }
  return [...ids]
}

export function orderGenders(o: Order, packsById: Map<string, Pack>, perfumesById: Map<string, Perfume>): string[] {
  const out = new Set<string>()
  for (const it of o.items) {
    if (it.kind === 'perfume') {
      const p = perfumesById.get(it.refId)
      if (p) out.add(p.gender)
    } else {
      const pack = packsById.get(it.refId)
      if (pack) out.add(pack.gender)
    }
  }
  return [...out]
}

// ── Range helpers ───────────────────────────────────────────────────────────
export const PRESET_DAYS: Record<Exclude<RangePreset, 'all' | 'ytd' | 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6m': 183,
  '12m': 365,
}

export function presetRange(preset: RangePreset, historyStart: string, historyEnd: string): { from: string; to: string } {
  const end = parseDay(historyEnd)
  if (preset === 'all') return { from: historyStart, to: historyEnd }
  if (preset === 'ytd') return { from: `${end.getUTCFullYear()}-01-01`, to: historyEnd }
  const days = PRESET_DAYS[preset as keyof typeof PRESET_DAYS] ?? 30
  const from = addDays(end, -(days - 1))
  return { from: dayKey(from) < historyStart ? historyStart : dayKey(from), to: historyEnd }
}

export function inRange(o: Order, from: string, to: string) {
  const k = dayKey(o.createdAt)
  return k >= from && k <= to
}

/** The immediately preceding window of equal length — powers every trend indicator. */
export function previousRange(from: string, to: string) {
  const length = daysBetween(parseDay(from), parseDay(to)) + 1
  const prevTo = addDays(parseDay(from), -1)
  return { from: dayKey(addDays(prevTo, -(length - 1))), to: dayKey(prevTo) }
}

// ── Filtering ───────────────────────────────────────────────────────────────
export interface FilterContext {
  packsById: Map<string, Pack>
  perfumesById: Map<string, Perfume>
}

export function filterOrders(orders: Order[], filters: Filters, ctx: FilterContext, range?: { from: string; to: string }) {
  const from = range?.from ?? filters.from
  const to = range?.to ?? filters.to
  const allChannels = filters.channels.length === 2 || filters.channels.length === 0
  const allClasses = filters.classes.length === 3 || filters.classes.length === 0
  const allGenders = filters.genders.length === 3 || filters.genders.length === 0

  return orders.filter((o) => {
    if (!inRange(o, from, to)) return false
    if (!allChannels && !filters.channels.includes(o.channel)) return false
    if (!allClasses || !allGenders) {
      const genders = orderGenders(o, ctx.packsById, ctx.perfumesById)
      if (!allGenders && !genders.some((g) => filters.genders.includes(g as never))) return false
      if (!allClasses) {
        const ids = orderPerfumeIds(o, ctx.packsById)
        const classes = ids.map((id) => ctx.perfumesById.get(id)?.abcClass).filter(Boolean) as ABCClass[]
        if (!classes.some((c) => filters.classes.includes(c))) return false
      }
    }
    return true
  })
}

// ── KPIs ────────────────────────────────────────────────────────────────────
export interface Kpis {
  revenue: number
  orders: number
  bottles: number
  profit: number
  margin: number
  aov: number
  returnRate: number
  customers: number
  repeatRate: number
  newCustomers: number
  onlineReturnRate: number
  localReturnRate: number
  localRevenue: number
  onlineRevenue: number
  onlineShare: number
  avgBasketBottles: number
}

export function computeKpis(orders: Order[], firstOrderByCustomer: Map<string, string>): Kpis {
  const counted = orders.filter(isCounted)
  const paid = orders.filter(isPaid)
  const revenue = paid.reduce((s, o) => s + o.revenue, 0)
  const profit = counted.reduce((s, o) => s + o.netProfit, 0)
  const bottles = counted.reduce((s, o) => s + orderBottles(o), 0)
  const localRevenue = paid.filter((o) => o.channel === 'LOCAL').reduce((s, o) => s + o.revenue, 0)
  const onlineRevenue = paid.filter((o) => o.channel === 'ONLINE').reduce((s, o) => s + o.revenue, 0)

  const delivered = counted.filter((o) => o.status === 'delivered').length
  const returned = counted.filter((o) => o.status === 'returned').length
  const onlineCounted = counted.filter((o) => o.channel === 'ONLINE')
  const onlineDelivered = onlineCounted.filter((o) => o.status === 'delivered').length
  const onlineReturned = onlineCounted.filter((o) => o.status === 'returned').length

  const byCustomer = new Map<string, number>()
  for (const o of counted) byCustomer.set(o.customerId, (byCustomer.get(o.customerId) ?? 0) + 1)
  const repeatCustomers = [...byCustomer.values()].filter((n) => n > 1).length
  let newCustomers = 0
  for (const [cid] of byCustomer) {
    const first = firstOrderByCustomer.get(cid)
    if (first && orders.some((o) => o.customerId === cid && dayKey(o.createdAt) === first)) newCustomers++
  }

  return {
    revenue: round2(revenue),
    orders: counted.length,
    bottles,
    profit: round2(profit),
    margin: revenue > 0 ? round1((profit / revenue) * 100) : 0,
    aov: paid.length ? round2(revenue / paid.length) : 0,
    returnRate: delivered + returned > 0 ? round1((returned / (delivered + returned)) * 100) : 0,
    customers: byCustomer.size,
    repeatRate: byCustomer.size ? round1((repeatCustomers / byCustomer.size) * 100) : 0,
    newCustomers,
    onlineReturnRate:
      onlineDelivered + onlineReturned > 0 ? round1((onlineReturned / (onlineDelivered + onlineReturned)) * 100) : 0,
    localReturnRate:
      delivered - onlineDelivered + returned - onlineReturned > 0
        ? round1(((returned - onlineReturned) / (delivered - onlineDelivered + returned - onlineReturned)) * 100)
        : 0,
    localRevenue: round2(localRevenue),
    onlineRevenue: round2(onlineRevenue),
    onlineShare: revenue > 0 ? round1((onlineRevenue / revenue) * 100) : 0,
    avgBasketBottles: counted.length ? round1(bottles / counted.length) : 0,
  }
}

export function trend(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null
  return round1(((current - previous) / Math.abs(previous)) * 100)
}

// ── Time series ─────────────────────────────────────────────────────────────
export type Granularity = 'day' | 'week' | 'month'

export function pickGranularity(from: string, to: string): Granularity {
  const days = daysBetween(parseDay(from), parseDay(to)) + 1
  if (days <= 45) return 'day'
  if (days <= 200) return 'week'
  return 'month'
}

/** ISO weeks, Monday first. */
function mondayOf(d: Date) {
  const dow = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1
  return addDays(startOfDay(d), -dow)
}

function bucketKey(o: Order, g: Granularity) {
  const d = new Date(o.createdAt)
  if (g === 'day') return dayKey(d)
  if (g === 'month') return monthKey(d)
  return dayKey(mondayOf(d))
}

export interface Bucket {
  key: string
  label: string
  orders: number
  revenue: number
  localRevenue: number
  onlineRevenue: number
  profit: number
  cost: number
  bottles: number
  returns: number
  aov: number
}

export function bucketOrders(orders: Order[], g: Granularity, opts: { fill?: boolean; from?: string; to?: string } = {}): Bucket[] {
  const map = new Map<string, Bucket>()
  const ensure = (key: string): Bucket => {
    let b = map.get(key)
    if (!b) {
      b = { key, label: key, orders: 0, revenue: 0, localRevenue: 0, onlineRevenue: 0, profit: 0, cost: 0, bottles: 0, returns: 0, aov: 0 }
      map.set(key, b)
    }
    return b
  }

  for (const o of orders) {
    if (o.status === 'cancelled') continue
    const b = ensure(bucketKey(o, g))
    b.orders += 1
    b.bottles += orderBottles(o)
    b.revenue += o.revenue
    if (o.channel === 'LOCAL') b.localRevenue += o.revenue
    else b.onlineRevenue += o.revenue
    b.profit += o.netProfit
    b.cost += o.totalCost
    if (o.returned) b.returns += 1
  }

  if (opts.fill && opts.from && opts.to) {
    const start = parseDay(opts.from)
    const end = parseDay(opts.to)
    let cursor = start
    let guard = 0
    while (cursor.getTime() <= end.getTime() && guard++ < 2000) {
      ensure(g === 'month' ? monthKey(cursor) : g === 'week' ? dayKey(mondayOf(cursor)) : dayKey(cursor))
      cursor = addDays(cursor, g === 'month' ? 28 : g === 'week' ? 7 : 1)
    }
  }

  return [...map.values()]
    .map((b) => ({ ...b, revenue: round2(b.revenue), profit: round2(b.profit), cost: round2(b.cost), aov: b.orders ? round2(b.revenue / b.orders) : 0 }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

/** Rolling cumulative profit/revenue for the area chart comparison. */
export function cumulative(series: Bucket[]) {
  let rev = 0
  let profit = 0
  return series.map((b) => {
    rev += b.revenue
    profit += b.profit
    return { key: b.key, revenueCum: round2(rev), profitCum: round2(profit) }
  })
}

// ── Breakdowns ──────────────────────────────────────────────────────────────
export interface SplitRow {
  name: string
  revenue: number
  profit: number
  orders: number
  bottles: number
}

export function channelSplit(orders: Order[]): SplitRow[] {
  const build = (channel: Channel, name: string): SplitRow => {
    const list = orders.filter((o) => o.channel === channel && o.status !== 'cancelled')
    const paid = list.filter(isPaid)
    return {
      name,
      revenue: round2(paid.reduce((s, o) => s + o.revenue, 0)),
      profit: round2(list.reduce((s, o) => s + o.netProfit, 0)),
      orders: list.length,
      bottles: list.reduce((s, o) => s + orderBottles(o), 0),
    }
  }
  return [build('LOCAL', 'Local'), build('ONLINE', 'Online')]
}

export function citySplit(orders: Order[], limit = 8): SplitRow[] {
  const map = new Map<string, SplitRow>()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    const row = map.get(o.city) ?? { name: o.city, revenue: 0, profit: 0, orders: 0, bottles: 0 }
    row.revenue += o.revenue
    row.profit += o.netProfit
    row.orders += 1
    row.bottles += orderBottles(o)
    map.set(o.city, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, revenue: round2(r.revenue), profit: round2(r.profit) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

export interface PerfumeStat {
  perfume: Perfume
  bottles: number
  revenue: number
  profit: number
  orders: number
}

/** Pack revenue is attributed to its components proportionally to bottle count. */
export function perfumeStats(orders: Order[], ctx: FilterContext): PerfumeStat[] {
  const map = new Map<string, PerfumeStat>()
  const get = (id: string) => {
    const p = ctx.perfumesById.get(id)
    if (!p) return null
    let row = map.get(id)
    if (!row) {
      row = { perfume: p, bottles: 0, revenue: 0, profit: 0, orders: 0 }
      map.set(id, row)
    }
    return row
  }

  const orderTouch = new Map<string, Set<string>>()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    const touched = new Set<string>()
    for (const it of o.items) {
      if (it.kind === 'perfume') {
        const row = get(it.refId)
        if (!row) continue
        row.bottles += it.bottles
        row.revenue += it.quantity * it.unitPrice
        row.profit += it.quantity * it.unitPrice - it.bottles * row.perfume.unitCost30ml
        touched.add(it.refId)
      } else {
        const pack = ctx.packsById.get(it.refId)
        if (!pack) continue
        const bottles = pack.items.reduce((s, c) => s + c.quantity, 0)
        for (const c of pack.items) {
          const row = get(c.perfumeId)
          if (!row) continue
          const share = c.quantity / bottles
          row.bottles += c.quantity
          row.revenue += it.unitPrice * share
          row.profit += it.unitPrice * share - c.quantity * row.perfume.unitCost30ml
          touched.add(c.perfumeId)
        }
      }
    }
    for (const id of touched) {
      orderTouch.set(id, orderTouch.get(id) ?? new Set())
      orderTouch.get(id)!.add(o.id)
    }
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      revenue: round2(r.revenue),
      profit: round2(r.profit),
      orders: orderTouch.get(r.perfume.id)?.size ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function classSplit(stats: PerfumeStat[]): SplitRow[] {
  const map = new Map<ABCClass, SplitRow>()
  for (const s of stats) {
    const key = s.perfume.abcClass
    const row = map.get(key) ?? { name: `Class ${key}`, revenue: 0, profit: 0, orders: 0, bottles: 0 }
    row.revenue += s.revenue
    row.profit += s.profit
    row.orders += s.orders
    row.bottles += s.bottles
    map.set(key, row)
  }
  return (['A', 'B', 'C'] as ABCClass[])
    .map((c) => map.get(c))
    .filter((r): r is SplitRow => Boolean(r))
    .map((r) => ({ ...r, revenue: round2(r.revenue), profit: round2(r.profit) }))
}

export function packStats(orders: Order[], ctx: FilterContext) {
  const map = new Map<string, { pack: Pack; units: number; revenue: number; profit: number }>()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    for (const it of o.items) {
      if (it.kind !== 'pack') continue
      const pack = ctx.packsById.get(it.refId)
      if (!pack) continue
      const row = map.get(it.refId) ?? { pack, units: 0, revenue: 0, profit: 0 }
      const unitProductionCost = pack.items.reduce(
        (s, c) => s + c.quantity * (ctx.perfumesById.get(c.perfumeId)?.unitCost30ml ?? 0),
        0,
      )
      row.units += it.quantity
      row.revenue += it.quantity * it.unitPrice
      row.profit += it.quantity * (it.unitPrice - unitProductionCost - RULES.deliveryFee - it.unitPrice * RULES.returnProvisionRate)
      map.set(it.refId, row)
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, revenue: round2(r.revenue), profit: round2(r.profit) }))
    .sort((a, b) => b.revenue - a.revenue)
}

/** When do Moroccans actually buy? Orders by weekday × hour. */
export function activityHeatmap(orders: Order[]) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const o of orders) {
    const d = new Date(o.createdAt)
    grid[d.getUTCDay()][d.getUTCHours()] += 1
  }
  return grid
}

// ── Two-channel P&L (mirrors the "Monthly P&L — Two Channels" tracker) ──────
export interface PLBucket {
  revenue: number
  production: number
  delivery: number
  returns: number
  profit: number
  margin: number
  orders: number
  bottles: number
}

function plBucket(orders: Order[]): PLBucket {
  const counted = orders.filter((o) => o.status !== 'cancelled')
  const revenue = counted.filter(isPaid).reduce((s, o) => s + o.revenue, 0)
  const production = counted.reduce((s, o) => s + o.productionCost, 0)
  const delivery = counted.reduce((s, o) => s + o.deliveryFee, 0)
  const returns = counted.reduce((s, o) => s + o.returnProvision + o.returnShipping, 0)
  const profit = counted.reduce((s, o) => s + o.netProfit, 0)
  return {
    revenue: round2(revenue),
    production: round2(production),
    delivery: round2(delivery),
    returns: round2(returns),
    profit: round2(profit),
    margin: revenue > 0 ? round1((profit / revenue) * 100) : 0,
    orders: counted.length,
    bottles: counted.reduce((s, o) => s + orderBottles(o), 0),
  }
}

export interface PnL {
  local: PLBucket
  online: PLBucket
  combined: PLBucket
  allocation: Array<{ label: string; rate: number; amount: number; hint: string }>
  expectedReturnLoss: number
  actualReturnLoss: number
}

export function buildPnL(orders: Order[]): PnL {
  const local = plBucket(orders.filter((o) => o.channel === 'LOCAL'))
  const online = plBucket(orders.filter((o) => o.channel === 'ONLINE'))
  const combined = plBucket(orders)
  const distributable = Math.max(0, combined.profit)
  const allocation = [
    { label: 'Stock', rate: RULES.allocation.stock, hint: 'Raw materials & next production run' },
    { label: 'Ads', rate: RULES.allocation.ads, hint: 'Online acquisition budget' },
    { label: 'Salary', rate: RULES.allocation.salary, hint: 'Founder salary' },
    { label: 'Savings', rate: RULES.allocation.savings, hint: 'Untouchable buffer' },
  ].map((a) => ({ ...a, amount: round2(distributable * a.rate) }))

  const onlineList = orders.filter((o) => o.channel === 'ONLINE' && o.status !== 'cancelled')
  const expectedReturnLoss = round2(onlineList.reduce((s, o) => s + o.returnProvision, 0))
  const actualReturnLoss = round2(
    onlineList.reduce((s, o) => (o.returned ? s + o.returnShipping + o.productionCost + o.deliveryFee : s), 0),
  )

  return { local, online, combined, allocation, expectedReturnLoss, actualReturnLoss }
}

/** Month-over-month P&L table for the finance screen. */
export function monthlyPnL(orders: Order[]) {
  const months = new Map<string, Order[]>()
  for (const o of orders) {
    const key = monthKey(o.createdAt)
    months.set(key, [...(months.get(key) ?? []), o])
  }
  return [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => {
      const pnl = buildPnL(list)
      return {
        month: key,
        local: pnl.local,
        online: pnl.online,
        combined: pnl.combined,
      }
    })
}

// ── Stock ───────────────────────────────────────────────────────────────────
export function stockValue(batches: ProductionBatch[], perfumesById: Map<string, Perfume>) {
  const sellableBottles = batches.filter((b) => b.status === 'IN_STOCK').reduce((s, b) => s + b.bottlesRemaining, 0)
  const maceratingBottles = batches
    .filter((b) => b.status === 'MACERATING' || b.status === 'READY')
    .reduce((s, b) => s + b.bottlesRemaining, 0)
  const value = batches
    .filter((b) => b.status === 'IN_STOCK')
    .reduce((s, b) => s + b.bottlesRemaining * (perfumesById.get(b.perfumeId)?.unitCost30ml ?? 0), 0)
  return { sellableBottles, maceratingBottles, value: round2(value) }
}
