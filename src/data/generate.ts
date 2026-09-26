import { DEMAND_WEIGHT, PACKS, PERFUMES, REGIONS, REGION_WEIGHTS, RULES } from './catalog'
import type {
  ABCClass,
  Channel,
  Customer,
  Dataset,
  Order,
  OrderItem,
  OrderStatus,
  Pack,
  Perfume,
  ProductionBatch,
  ReorderAlert,
} from '../lib/types'
import { addDays, dayKey, daysBetween, parseDay, startOfDay } from '../lib/dates'

/**
 * Deterministic simulator for WAHJ PARFUMS.
 *
 * It plays the business forward day by day, applying the real rules from the
 * strategy doc:
 *   • LOCAL  = singles + 2-packs, no delivery fee, no return provision
 *   • ONLINE = packs only, 35 DH delivery absorbed, 15% return provision
 *   • production happens in 16-bottle batches, sellable 14 days after production
 *   • reorder triggers per ABC class (A=8, B=5, C=3) start a new batch
 *   • sellable stock ≠ total stock: macerating bottles never count for customers
 *
 * Same seed → same data, so screenshots, exports and reviews stay stable.
 */

// ── Random ──────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number

function randInt(rng: Rng, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]
}

function weightedPick<T>(rng: Rng, arr: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rng() * total
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i]
    if (r <= 0) return arr[i]
  }
  return arr[arr.length - 1]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const round1 = (n: number) => Math.round(n * 10) / 10

// ── Seasonality ─────────────────────────────────────────────────────────────
interface Season {
  from: number
  to: number
  label: string
  online: number
  local: number
}

function buildSeasons(startMs: number, endMs: number): Season[] {
  const windows: Array<[string, string, string, number, number]> = [
    // [from, to, label, onlineMultiplier, localMultiplier]
    ['2025-03-25', '2025-04-03', 'Eid al-Fitr', 1.55, 1.35],
    ['2025-06-01', '2025-06-09', 'Eid al-Adha', 1.45, 1.3],
    ['2025-12-12', '2025-12-31', 'Holiday season', 1.4, 1.15],
    ['2026-02-05', '2026-03-19', 'Ramadan', 1.6, 1.4],
    ['2026-03-20', '2026-03-25', 'Eid al-Fitr', 1.8, 1.5],
    ['2026-05-20', '2026-05-29', 'Eid al-Adha', 1.65, 1.4],
    ['2026-06-10', '2026-09-15', 'Summer', 1.12, 1.28],
  ]
  // Recurring December window for whichever year the range touches (data stays fresh).
  for (const y of [2025, 2026, 2027]) {
    if (!windows.some((w) => w[0] === `${y}-12-12`)) {
      windows.push([`${y}-12-12`, `${y}-12-31`, 'Holiday season', 1.4, 1.15])
    }
  }
  return windows
    .map(([from, to, label, online, local]) => ({
      from: parseDay(from).getTime(),
      to: parseDay(to).getTime(),
      label,
      online,
      local,
    }))
    .filter((s) => s.to >= startMs && s.from <= endMs)
}

export function seasonLabelFor(dayMs: number, seasons: Season[]): string | null {
  const hit = seasons.find((s) => dayMs >= s.from && dayMs <= s.to)
  return hit ? hit.label : null
}

// ── People & places ─────────────────────────────────────────────────────────
const FIRST_M = ['Youssef', 'Mehdi', 'Anas', 'Othmane', 'Bilal', 'Hamza', 'Adam', 'Reda', 'Ilias', 'Marouane', 'Karim', 'Zakaria', 'Ayoub', 'Nabil', 'Simo']
const FIRST_F = ['Salma', 'Yasmine', 'Imane', 'Nada', 'Hajar', 'Sara', 'Kenza', 'Aya', 'Ghita', 'Lina', 'Malak', 'Rim', 'Zineb', 'Douae', 'Nisrine']
const LAST = ['El Amrani', 'Benali', 'Tahiri', 'Zeroual', 'Bennani', 'El Idrissi', 'Chraibi', 'Ouali', 'Berrada', 'Fassi', 'Lahlou', 'Sabri', 'Kettani', 'Moutawakil', 'Dahbi', 'Naciri']

function makeCustomer(rng: Rng, index: number, channel: Channel, createdAt: Date): Customer {
  const female = rng() < 0.52
  const first = female ? pick(rng, FIRST_F) : pick(rng, FIRST_M)
  const last = pick(rng, LAST)
  const city = weightedPick(
    rng,
    REGIONS,
    REGIONS.map((r) => REGION_WEIGHTS[r] ?? 1),
  )
  const prefix = rng() < 0.5 ? '+212 6' : '06'
  const digits = () => randInt(rng, 10, 99)
  return {
    id: `CUS-${String(index).padStart(4, '0')}`,
    name: `${first} ${last}`,
    phone: `${prefix}${randInt(rng, 10, 99)} ${digits()} ${digits()} ${digits()}`,
    city: channel === 'LOCAL' ? (rng() < 0.72 ? 'Casablanca' : pick(rng, ['Mohammedia', 'Bouskoura', 'Rabat', 'Salé'])) : city,
    channelAcquired: channel,
    totalOrders: 0,
    totalSpent: 0,
    bottlesThisCycle: 0,
    loyaltyRewards: 0,
    lastOrderAt: dayKey(createdAt),
  }
}

// ── Order generation ────────────────────────────────────────────────────────
function buildLocalOrder(rng: Rng, perfumes: Perfume[]): { type: 'SINGLE' | 'TWO_PACK'; items: OrderItem[]; bottlesByPerfume: Record<string, number> } {
  const isDuo = rng() < 0.34
  const bottlesByPerfume: Record<string, number> = {}
  const weights = perfumes.map((p) => DEMAND_WEIGHT[p.id] ?? 1)

  if (!isDuo) {
    const qty = weightedPick(rng, [1, 1, 1, 2, 3], [46, 14, 14, 18, 8])
    const items: OrderItem[] = []
    for (let i = 0; i < qty; i++) {
      const p = weightedPick(rng, perfumes, weights)
      bottlesByPerfume[p.id] = (bottlesByPerfume[p.id] ?? 0) + 1
      const existing = items.find((it) => it.refId === p.id)
      if (existing) {
        // Merging two bottles of the same perfume — bottles must track quantity.
        existing.quantity += 1
        existing.bottles += 1
      } else items.push({ kind: 'perfume', refId: p.id, name: `${p.name} — ${p.brand}`, quantity: 1, unitPrice: p.localSinglePrice, bottles: 1 })
    }
    // 2 bottles of the same perfume are billed as the duo price, not 2 singles.
    for (const it of items) {
      if (it.quantity >= 2) {
        const p = perfumes.find((x) => x.id === it.refId)!
        it.unitPrice = round2(p.localDuoPrice / it.quantity)
      }
    }
    return { type: 'SINGLE', items, bottlesByPerfume }
  }

  const duoCount = rng() < 0.22 ? 2 : 1
  const items: OrderItem[] = []
  for (let d = 0; d < duoCount; d++) {
    const p = weightedPick(rng, perfumes, weights)
    bottlesByPerfume[p.id] = (bottlesByPerfume[p.id] ?? 0) + 2
    items.push({ kind: 'perfume', refId: p.id, name: `${p.name} — ${p.brand}`, quantity: 2, unitPrice: p.localDuoPrice / 2, bottles: 2 })
  }
  return { type: 'TWO_PACK', items, bottlesByPerfume }
}

function buildOnlineOrder(
  rng: Rng,
  packs: Pack[],
  perfumesById: Map<string, Perfume>,
  season: { online: number } | null,
): { items: OrderItem[]; bottlesByPerfume: Record<string, number> } {
  const weights = packs.map((p) => {
    let w = p.price <= 200 ? 12 : p.price <= 260 ? 22 : p.price <= 300 ? 18 : 14
    if (season && season.online > 1.3) {
      if (p.id === 'pack-eid') w *= 2.6
      if (p.id === 'pack-gift-box') w *= 1.5
      if (p.id === 'pack-couple') w *= 1.2
    }
    if (p.id === 'pack-parfait-femme') w *= 1.15
    return w
  })
  const packCount = rng() < 0.13 ? 2 : 1
  const items: OrderItem[] = []
  const bottlesByPerfume: Record<string, number> = {}

  for (let i = 0; i < packCount; i++) {
    const pack = weightedPick(rng, packs, weights)
    const bottles = pack.items.reduce((s, it) => s + it.quantity, 0)
    for (const component of pack.items) {
      bottlesByPerfume[component.perfumeId] = (bottlesByPerfume[component.perfumeId] ?? 0) + component.quantity * 1
    }
    items.push({ kind: 'pack', refId: pack.id, name: pack.name, quantity: 1, unitPrice: pack.price, bottles })
  }
  // Guard: packs are always intact (never re-bundled), but the map is the source of truth.
  void perfumesById
  return { items, bottlesByPerfume }
}

function statusForAge(rng: Rng, ageDays: number, channel: Channel): OrderStatus {
  if (ageDays >= 14) {
    const r = rng()
    const returnRate = channel === 'ONLINE' ? 0.112 : 0.014
    if (r < returnRate) return 'returned'
    if (r < returnRate + 0.012) return 'cancelled'
    return 'delivered'
  }
  if (ageDays >= 4) {
    const r = rng()
    if (r < 0.77) return 'delivered'
    if (r < 0.86) return 'shipped'
    if (r < 0.9) return 'confirmed'
    if (r < 0.95) return 'returned'
    if (r < 0.975) return 'cancelled'
    return 'pending'
  }
  const r = rng()
  if (r < 0.44) return 'pending'
  if (r < 0.82) return 'confirmed'
  if (r < 0.93) return 'shipped'
  if (r < 0.97) return 'delivered'
  return 'cancelled'
}

const LAUNCH_OFFSET: Record<string, number> = { aventus: 300, 'lost-cherry': 388, hacivat: 120 }

export interface GenerateOptions {
  seed?: number
  historyDays?: number
}

export function buildDataset(options: GenerateOptions = {}): Dataset {
  const seed = options.seed ?? 20260926
  const historyDays = options.historyDays ?? 545
  const rng = mulberry32(seed)

  const end = startOfDay(new Date())
  const start = addDays(end, -historyDays)
  const seasons = buildSeasons(start.getTime(), end.getTime())

  const perfumes = PERFUMES
  const packs = PACKS
  const perfumesById = new Map(perfumes.map((p) => [p.id, p]))

  const orders: Order[] = []
  const customers: Customer[] = []
  const customerPool: Customer[] = []
  let customerSeq = 1

  // A loyal core that existed before this history window (WhatsApp regulars,
  // hairdressers, the local hanout) — they carry the repeat-purchase metrics.
  const regulars: Customer[] = []
  for (let i = 0; i < 120; i++) {
    const channel: Channel = rng() < 0.72 ? 'LOCAL' : 'ONLINE'
    const c = makeCustomer(rng, customerSeq++, channel, addDays(start, -randInt(rng, 20, 400)))
    c.totalOrders = randInt(rng, 1, 6)
    regulars.push(c)
    customerPool.push(c)
    customers.push(c)
  }
  const soldByPerfumeDay = new Map<string, number>() // `${day}|${perfumeId}` → bottles

  const addSold = (day: string, map: Record<string, number>) => {
    for (const [pid, qty] of Object.entries(map)) {
      const k = `${day}|${pid}`
      soldByPerfumeDay.set(k, (soldByPerfumeDay.get(k) ?? 0) + qty)
    }
  }

  let orderSeq = 1
  for (let d = 0; d <= historyDays; d++) {
    const day = addDays(start, d)
    const dayMs = day.getTime()
    const dow = day.getUTCDay() // 0 = Sunday
    const dayOfMonth = day.getUTCDate()

    const progress = d / historyDays
    const localTrend = 1 + progress * 0.85
    const onlineTrend = 1 + progress * 1.5 + (progress > 0.42 ? 0.25 : 0) // ads push in month ~8
    const dowLocal = [1.06, 0.82, 0.86, 0.92, 0.98, 1.22, 1.3][dow]
    const dowOnline = [1.24, 0.86, 0.9, 0.94, 1.0, 1.14, 1.18][dow]
    // salary week-end effect (1st–5th of the month) and a small mid-month dip
    const payday = dayOfMonth <= 5 ? 1.14 : dayOfMonth >= 25 ? 1.08 : 0.97

    const season = seasons.find((s) => dayMs >= s.from && dayMs <= s.to) ?? null
    const seasonLocal = season ? season.local : 1
    const seasonOnline = season ? season.online : 1

    // Volume is deliberately capped by real production capacity: 16 bottles per
    // batch, 14 days of maceration, one pair of hands. ~1.6 local + ~0.8 online
    // orders/day at the start of history, roughly doubling by today.
    const expectedLocal = 1.55 * localTrend * dowLocal * payday * seasonLocal * (0.78 + rng() * 0.46)
    const expectedOnline = 0.78 * onlineTrend * dowOnline * payday * seasonOnline * (0.74 + rng() * 0.5)
    const nLocal = Math.floor(expectedLocal) + (rng() < expectedLocal % 1 ? 1 : 0)
    const nOnline = Math.floor(expectedOnline) + (rng() < expectedOnline % 1 ? 1 : 0)

    // available perfumes on this day (new arrivals launch mid-history)
    const livePerfumes = perfumes.filter((p) => d >= (LAUNCH_OFFSET[p.id] ?? 0))

    const ageDays = historyDays - d

    const pushOrder = (
      channel: Channel,
      items: OrderItem[],
      bottlesByPerfume: Record<string, number>,
      orderType: Order['orderType'],
    ) => {
      const grossRevenue = round2(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0))
      const status = statusForAge(rng, ageDays, channel)
      if (status === 'cancelled' && rng() < 0.45) return // some cancellations never reach the books at all

      // WhatsApp-driven business: a core of regulars keeps reordering, plus a
      // constant stream of first-time COD buyers.
      const repeat = channel === 'LOCAL' ? rng() < 0.74 : rng() < 0.42
      let customer: Customer
      if (repeat && customerPool.length > 8) {
        const pool = rng() < 0.72 ? regulars : customerPool
        const sameChannel = pool.filter((c) => c.channelAcquired === channel && c.totalOrders < 16)
        const fallback = pool.filter((c) => c.totalOrders < 16)
        const candidates = sameChannel.length ? sameChannel : fallback
        customer = candidates.length ? pick(rng, candidates) : pick(rng, customerPool)
      } else {
        customer = makeCustomer(rng, customerSeq++, channel, day)
        customers.push(customer)
        customerPool.push(customer)
      }

      const productionCost = round2(
        Object.entries(bottlesByPerfume).reduce((s, [pid, qty]) => {
          const p = perfumesById.get(pid)
          return s + (p ? p.unitCost30ml * qty : 0)
        }, 0),
      )
      const deliveryFee = channel === 'ONLINE' ? RULES.deliveryFee : 0
      const returnProvision = channel === 'ONLINE' ? round2(grossRevenue * RULES.returnProvisionRate) : 0
      const returned = status === 'returned'
      const returnShipping = returned ? (channel === 'ONLINE' ? 25 : 0) : 0
      const cancelled = status === 'cancelled'
      const revenue = returned || cancelled ? 0 : grossRevenue
      const totalCost = cancelled ? 0 : round2(productionCost + deliveryFee + returnProvision + returnShipping)

      const hours = randInt(rng, 9, 22)
      const minutes = randInt(rng, 0, 59)
      const createdAt = new Date(dayMs + hours * 3600000 + minutes * 60000)

      const order: Order = {
        id: `ORD-${String(orderSeq).padStart(5, '0')}`,
        code: `WAHJ-${String(2600 + orderSeq)}`,
        channel,
        orderType,
        status,
        createdAt: createdAt.toISOString(),
        customerId: customer.id,
        city: customer.city,
        items,
        deliveryFee,
        returnProvision,
        returned,
        returnShipping,
        grossRevenue,
        revenue,
        productionCost,
        totalCost,
        netProfit: cancelled ? 0 : round2(revenue - totalCost),
      }
      orders.push(order)
      orderSeq++

      if (!cancelled) {
        customer.totalOrders += 1
        customer.totalSpent = round2(customer.totalSpent + revenue)
        customer.bottlesThisCycle += Object.values(bottlesByPerfume).reduce((s, n) => s + n, 0)
        customer.lastOrderAt = dayKey(day)
        if (customer.bottlesThisCycle >= 5) {
          customer.loyaltyRewards += 1
          customer.bottlesThisCycle -= 5
        }
        addSold(dayKey(day), bottlesByPerfume)
      }
    }

    for (let i = 0; i < nLocal; i++) {
      if (!livePerfumes.length) break
      const o = buildLocalOrder(rng, livePerfumes)
      pushOrder('LOCAL', o.items, o.bottlesByPerfume, o.type)
    }
    for (let i = 0; i < nOnline; i++) {
      const o = buildOnlineOrder(rng, packs, perfumesById, season)
      pushOrder('ONLINE', o.items, o.bottlesByPerfume, 'PACK')
    }
  }

  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  // ── Production simulation (batches, FIFO consumption, maceration) ─────────
  const batches: ProductionBatch[] = []
  const alerts: ReorderAlert[] = []
  let batchSeq = 1
  let alertSeq = 1

  for (const p of perfumes) {
    const launch = LAUNCH_OFFSET[p.id] ?? 0
    const trigger = RULES.reorderTriggers[p.abcClass]
    const live: ProductionBatch[] = []
    let blockedUntil = -1
    let belowSince: string | null = null
    let belowAt = 0
    let confirmLag = 0

    // The business doesn't start from zero: there is already confirmed stock on
    // the shelf the day this history window opens.
    if (launch === 0) {
      const bottles = p.abcClass === 'C' ? 8 : p.recipe.bottlesPerBatch
      live.push({
        id: `BAT-${String(batchSeq).padStart(4, '0')}`,
        code: `B${String(1000 + batchSeq)}`,
        perfumeId: p.id,
        productionDate: dayKey(addDays(start, -24)),
        readyDate: dayKey(addDays(start, -10)),
        bottleCount: bottles,
        bottlesRemaining: Math.max(2, bottles - randInt(rng, 0, 6)),
        status: 'IN_STOCK',
        salesStartedAt: dayKey(addDays(start, -9)),
        costPerBatch: round2(p.unitCost30ml * bottles),
        costPerBottle: p.unitCost30ml,
      })
      batchSeq++
    }

    for (let d = 0; d <= historyDays; d++) {
      const day = addDays(start, d)
      const key = dayKey(day)

      // 1 — maceration → ready → (human confirmation) → in stock
      for (const b of live) {
        if (b.status === 'MACERATING' && parseDay(b.readyDate).getTime() <= day.getTime()) {
          b.status = 'READY'
        }
        if (b.status === 'READY') {
          const readyMs = parseDay(b.readyDate).getTime()
          const lagDays = 1 + (confirmLag % 3)
          if (day.getTime() - readyMs >= lagDays * 86400000) {
            b.status = 'IN_STOCK'
            b.salesStartedAt = key
          }
        }
      }

      const sellable = live.filter((b) => b.status === 'IN_STOCK').reduce((s, b) => s + b.bottlesRemaining, 0)
      const incoming = live.filter((b) => b.status === 'MACERATING' || b.status === 'READY').reduce((s, b) => s + b.bottlesRemaining, 0)

      // 2 — reorder engine: produce when pipeline can't cover the class trigger
      const soldToday = soldByPerfumeDay.get(`${key}|${p.id}`) ?? 0
      const coverage = sellable + incoming - soldToday
      if (d >= launch && d > blockedUntil && coverage <= trigger) {
        // real life: the founder is sometimes late on production (less reliable on C-class)
        const delayProb = p.abcClass === 'A' ? 0.14 : p.abcClass === 'B' ? 0.22 : 0.3
        if (rng() < delayProb) {
          blockedUntil = d + randInt(rng, 2, 9)
        } else {
          const bottles = p.abcClass === 'C' && rng() < 0.25 ? 8 : p.recipe.bottlesPerBatch
          const readyDate = addDays(day, RULES.macerationDays)
          const costPerBottle = p.unitCost30ml
          confirmLag++
          live.push({
            id: `BAT-${String(batchSeq).padStart(4, '0')}`,
            code: `B${String(1000 + batchSeq)}`,
            perfumeId: p.id,
            productionDate: key,
            readyDate: dayKey(readyDate),
            bottleCount: bottles,
            bottlesRemaining: bottles,
            status: 'MACERATING',
            salesStartedAt: null,
            costPerBatch: round2(costPerBottle * bottles),
            costPerBottle,
          })
          batchSeq++
        }
      }

      // 3 — sell FIFO from confirmed stock
      let toSell = soldToday
      const inStock = live.filter((b) => b.status === 'IN_STOCK').sort((a, b) => a.productionDate.localeCompare(b.productionDate))
      for (const b of inStock) {
        if (toSell <= 0) break
        const take = Math.min(b.bottlesRemaining, toSell)
        b.bottlesRemaining -= take
        toSell -= take
        if (b.bottlesRemaining <= 0) b.status = 'DEPLETED'
      }

      // 4 — reorder alert bookkeeping (only classes A/B/C with live demand)
      const afterSell = live.filter((b) => b.status === 'IN_STOCK').reduce((s, b) => s + b.bottlesRemaining, 0)
      if (d >= launch) {
        if (afterSell < trigger && belowSince === null) {
          belowSince = key
          belowAt = afterSell
        } else if (afterSell >= trigger + 2 && belowSince !== null) {
          alerts.push({
            id: `ALT-${String(alertSeq++).padStart(4, '0')}`,
            perfumeId: p.id,
            class: p.abcClass,
            trigger,
            sellableAtTrigger: belowAt,
            triggeredAt: belowSince,
            status: 'resolved',
          })
          belowSince = null
        }
      }
    }

    if (belowSince) {
      alerts.push({
        id: `ALT-${String(alertSeq++).padStart(4, '0')}`,
        perfumeId: p.id,
        class: p.abcClass,
        trigger,
        sellableAtTrigger: belowAt,
        triggeredAt: belowSince,
        status: 'open',
      })
    }
    batches.push(...live)
  }

  batches.sort((a, b) => b.productionDate.localeCompare(a.productionDate))

  // Normalise customer aggregates
  for (const c of customers) {
    c.totalSpent = round2(c.totalSpent)
  }

  return {
    perfumes,
    packs,
    orders,
    batches,
    customers,
    alerts,
    generatedAt: new Date().toISOString(),
    historyStart: dayKey(start),
    historyEnd: dayKey(end),
  }
}

/** Stock view: sellable stock is the only number that matters for customers & reorders. */
export function getStockRows(dataset: Dataset, batchesOverride?: ProductionBatch[]) {
  const byPerfume = new Map<string, ProductionBatch[]>()
  for (const b of batchesOverride ?? dataset.batches) {
    const list = byPerfume.get(b.perfumeId) ?? []
    list.push(b)
    byPerfume.set(b.perfumeId, list)
  }
  const today = startOfDay(new Date())

  return dataset.perfumes.map((perfume) => {
    const batches = (byPerfume.get(perfume.id) ?? []).sort((a, b) => b.productionDate.localeCompare(a.productionDate))
    const sellable = batches.filter((b) => b.status === 'IN_STOCK').reduce((s, b) => s + b.bottlesRemaining, 0)
    const macerating = batches
      .filter((b) => b.status === 'MACERATING' || b.status === 'READY')
      .reduce((s, b) => s + b.bottlesRemaining, 0)
    const trigger = RULES.reorderTriggers[perfume.abcClass]
    const cooking = batches
      .filter((b) => b.status === 'MACERATING' || b.status === 'READY')
      .map((b) => daysBetween(today, parseDay(b.readyDate)))
      .sort((a, b) => a - b)
    return {
      perfume,
      sellable,
      macerating,
      total: sellable + macerating,
      trigger,
      reorderStatus: (sellable < Math.ceil(trigger / 2) ? 'urgent' : sellable < trigger ? 'reorder' : 'ok') as
        | 'ok'
        | 'reorder'
        | 'urgent',
      nextReadyInDays: cooking.length ? Math.max(0, cooking[0]) : null,
      batches,
    }
  })
}

export const classRank: Record<ABCClass, number> = { A: 0, B: 1, C: 2 }

export function packCost(pack: Pack, perfumesById: Map<string, Perfume>) {
  const bottles = pack.items.reduce((s, it) => s + it.quantity, 0)
  const production = pack.items.reduce((s, it) => {
    const p = perfumesById.get(it.perfumeId)
    return s + (p ? p.unitCost30ml * it.quantity : 0)
  }, 0)
  const delivery = RULES.deliveryFee
  const provision = round2(pack.price * RULES.returnProvisionRate)
  const total = round2(production + delivery + provision)
  const profit = round2(pack.price - total)
  return {
    bottles,
    production: round2(production),
    delivery,
    provision,
    total,
    profit,
    margin: round1((profit / pack.price) * 100),
  }
}
