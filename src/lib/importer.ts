/**
 * CSV import — the bridge from the founder's spreadsheet world to this dashboard.
 *
 * Three importable shapes, auto-detected from the header row:
 *   • orders      — one row per order, or one row per order line (grouped by order code)
 *   • production  — a production/batch log (creates batches with calculated ready dates)
 *   • products    — your own catalogue (name, brand, gender, class, oil cost, prices)
 *
 * Nothing is destructive: the importer returns a preview + warnings, and the
 * dashboard only swaps its data when the user confirms.
 */
import { BASE_RECIPE, calculateBatchCost, DEMAND_WEIGHT } from '../data/catalog'
import type {
  ABCClass,
  Channel,
  Customer,
  Gender,
  Order,
  OrderStatus,
  OrderType,
  Pack,
  Perfume,
  ProductionBatch,
} from './types'
import { addDays, dayKey, parseDay } from './dates'

// ── CSV parsing (RFC4180-ish, tolerant) ─────────────────────────────────────
function detectDelimiter(sample: string): string {
  const firstLines = sample.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5)
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestScore = -1
  for (const c of candidates) {
    const counts = firstLines.map((l) => (l.match(new RegExp(`\\${c}`, 'g')) ?? []).length)
    if (!counts.length) continue
    const avg = counts.reduce((s, n) => s + n, 0) / counts.length
    const variance = Math.max(...counts) - Math.min(...counts)
    const score = avg * 10 - variance
    if (avg > 0 && score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

export function parseCsv(input: string): { headers: string[]; rows: Array<Record<string, string>>; delimiter: string } {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const delimiter = detectDelimiter(text)
  const cells: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      cells.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field.length || row.length) {
    row.push(field)
    cells.push(row)
  }

  const nonEmpty = cells.filter((r) => r.some((c) => c.trim() !== ''))
  if (!nonEmpty.length) return { headers: [], rows: [], delimiter }
  const headers = nonEmpty[0].map((h) => h.trim())
  const rows = nonEmpty.slice(1).map((r) => {
    const record: Record<string, string> = {}
    headers.forEach((h, i) => (record[h] = (r[i] ?? '').trim()))
    return record
  })
  return { headers, rows, delimiter }
}

// ── Value coercion ──────────────────────────────────────────────────────────
const normaliseKey = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

export function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const cleaned = String(raw)
    .replace(/[^\d.,\-]/g, '')
    .trim()
  if (!cleaned) return null
  const hasDot = cleaned.includes('.')
  const hasComma = cleaned.includes(',')
  let value = cleaned
  if (hasDot && hasComma) {
    value = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '')
  } else if (hasComma) {
    const decimals = cleaned.split(',').pop()?.length ?? 0
    value = decimals === 3 && cleaned.split(',').length === 2 ? cleaned.replace(',', '') : cleaned.replace(',', '.')
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Accepts ISO, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy and Excel serial dates. */
export function toDayKey(raw: string | undefined): string | null {
  if (!raw) return null
  const v = String(raw).trim()
  if (!v) return null
  const iso = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const eu = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (eu) {
    let [, d, m, y] = eu
    if (y.length === 2) y = `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const serial = Number(v)
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const ms = Math.round((serial - 25569) * 86400000)
    return dayKey(new Date(ms))
  }
  const parsed = new Date(v)
  if (!Number.isNaN(parsed.getTime())) return dayKey(parsed)
  return null
}

const pick = (row: Record<string, string>, ...aliases: string[]): string | undefined => {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const target = normaliseKey(alias)
    const hit = keys.find((k) => normaliseKey(k) === target)
    if (hit && row[hit] !== '') return row[hit]
  }
  // loose contains match as a fallback
  for (const alias of aliases) {
    const target = normaliseKey(alias)
    const hit = keys.find((k) => normaliseKey(k).includes(target))
    if (hit && row[hit] !== '') return row[hit]
  }
  return undefined
}

// ── Header detection ────────────────────────────────────────────────────────
export type ImportKind = 'orders' | 'production' | 'products'

export function detectKind(headers: string[]): ImportKind | 'unknown' {
  const keys = headers.map(normaliseKey)
  const has = (...aliases: string[]) => aliases.some((a) => keys.some((k) => k === normaliseKey(a)))
  const hasLike = (...aliases: string[]) => aliases.some((a) => keys.some((k) => k.includes(normaliseKey(a))))

  // Orders carry a sales channel / a customer / a basket of items.
  if (has('channel', 'canal', 'customer', 'client', 'customer_name', 'customer_phone') || hasLike('items', 'articles', 'order_code', 'commande')) {
    return 'orders'
  }
  // Production logs are about a single perfume, a make date and bottles produced.
  if (
    has('production_date', 'date_production', 'ready_date', 'maceration_ready_date', 'batch', 'lot', 'maceration') ||
    (has('perfume', 'parfum', 'nom', 'name', 'product') && has('bottles', 'bouteilles', 'bottle_count') && has('date', 'production_date'))
  ) {
    return 'production'
  }
  // Everything else that describes a product itself.
  if (
    has('brand', 'marque', 'gender', 'genre', 'abc_class', 'classe', 'class', 'oil_cost', 'cout_huile', 'family', 'famille') ||
    (has('name', 'nom', 'perfume', 'parfum', 'product', 'produit') && has('price', 'prix', 'local_single_price', 'unit_price'))
  ) {
    return 'products'
  }
  if (has('name', 'nom', 'perfume', 'parfum', 'product', 'produit')) return 'products'
  return 'unknown'
}

// ── Matching against the catalogue ──────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export function buildNameIndex(perfumes: Perfume[]) {
  const index = new Map<string, Perfume>()
  for (const p of perfumes) {
    index.set(norm(p.id), p)
    index.set(norm(p.name), p)
    index.set(norm(`${p.brand} ${p.name}`), p)
    index.set(norm(`${p.name} ${p.brand}`), p)
  }
  return index
}

export function matchPerfume(name: string, index: Map<string, Perfume>, perfumes: Perfume[]): Perfume | null {
  const key = norm(name)
  if (!key) return null
  const direct = index.get(key)
  if (direct) return direct
  // "Sauvage — Dior" / "Sauvage Dior 30ml" style
  for (const [k, p] of index) {
    if (k.length > 3 && (key.includes(k) || k.includes(key))) return p
  }
  const first = key.split(' ')[0]
  return perfumes.find((p) => norm(p.name).startsWith(first) && first.length > 3) ?? null
}

export function slugify(s: string) {
  return norm(s).replace(/\s+/g, '-').slice(0, 48) || `sku-${Math.random().toString(36).slice(2, 7)}`
}

export function makePerfumeFromName(name: string, overrides: Partial<Perfume> = {}): Perfume {
  const cost = calculateBatchCost(BASE_RECIPE)
  const clean = name.trim().replace(/\s*[—–-]\s*[A-Z][\w'&.]*$/, '').trim() || name.trim()
  const brandGuess = name.includes('—') || name.includes(' - ') ? name.split(/[—–]| - /).pop()!.trim() : ''
  return {
    id: slugify(name),
    name: clean,
    brand: brandGuess || '—',
    gender: 'unisex',
    family: 'Imported',
    abcClass: 'B',
    status: 'active',
    recipe: BASE_RECIPE,
    unitCost30ml: Math.round(cost.perBottle * 100) / 100,
    localSinglePrice: 49,
    localDuoPrice: 89,
    ...overrides,
  }
}

// ── Value mapping ───────────────────────────────────────────────────────────
function mapChannel(raw: string | undefined): Channel | null {
  if (!raw) return null
  const v = normaliseKey(raw)
  if (['local', 'boutique', 'magasin', 'maison', 'domicile', 'surplace', 'cash', 'espece'].some((x) => v.includes(x))) return 'LOCAL'
  if (['online', 'ligne', 'web', 'colis', 'livraison', 'instagram', 'insta', 'facebook', 'whatsapp'].some((x) => v.includes(x))) return 'ONLINE'
  return null
}

function mapStatus(raw: string | undefined): OrderStatus {
  const v = normaliseKey(raw ?? '')
  if (['livre', 'delivered', 'livree', 'recu', 'received'].some((x) => v.includes(x))) return 'delivered'
  if (['retour', 'return', 'refuse', 'refused'].some((x) => v.includes(x))) return 'returned'
  if (['annul', 'cancel'].some((x) => v.includes(x))) return 'cancelled'
  if (['expedi', 'shipped', 'enroute', 'enroute'].some((x) => v.includes(x))) return 'shipped'
  if (['confirm', 'prepar'].some((x) => v.includes(x))) return 'confirmed'
  return 'pending'
}

function mapGender(raw: string | undefined): Gender | null {
  if (!raw) return null
  const v = normaliseKey(raw)
  if (['homme', 'men', 'man', 'male', 'رجال'].some((x) => v.includes(x))) return 'men'
  if (['femme', 'women', 'woman', 'female', 'نساء'].some((x) => v.includes(x))) return 'women'
  if (['unisex', 'mixte', 'both'].some((x) => v.includes(x))) return 'unisex'
  return null
}

function mapClass(raw: string | undefined): ABCClass | null {
  if (!raw) return null
  const v = (raw.trim().toUpperCase().match(/[ABC]/) ?? [])[0]
  return (v as ABCClass) ?? null
}

/** "2× Sauvage; 1× Khamrah" → [{ name, qty }] */
export function parseItemsText(text: string): Array<{ name: string; qty: number }> {
  return text
    .split(/[;|\n]|(?:\s\+\s)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      const patterns = [
        /^(\d+)\s*[x×*]\s*(.+)$/i,
        /^(.+?)\s*[x×*]\s*(\d+)$/i,
        /^(\d+)\s+(.+)$/,
        /^(.+?)\s*\((\d+)\)$/,
      ]
      for (let i = 0; i < patterns.length; i++) {
        const m = chunk.match(patterns[i])
        if (!m) continue
        const qtyFirst = i === 0 || i === 2
        const qty = Number(qtyFirst ? m[1] : m[2])
        const name = (qtyFirst ? m[2] : m[1]).trim()
        return name ? [{ name, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 }] : []
      }
      return chunk ? [{ name: chunk, qty: 1 }] : []
    })
}

// ── Importers ───────────────────────────────────────────────────────────────
export interface ImportContext {
  perfumes: Perfume[]
  packs: Pack[]
  deliveryFee: number
  returnProvisionRate: number
  macerationDays: number
}

export interface ImportPreview {
  kind: ImportKind | 'unknown'
  orders: Order[]
  batches: ProductionBatch[]
  perfumes: Perfume[]
  customers: Customer[]
  warnings: string[]
  info: string[]
  rowCount: number
  /** Set when the importer invented a product it did not recognise. */
  newPerfumes: Perfume[]
}

const EMPTY = (kind: ImportPreview['kind'], rowCount: number): ImportPreview => ({
  kind,
  orders: [],
  batches: [],
  perfumes: [],
  customers: [],
  warnings: [],
  info: [],
  rowCount,
  newPerfumes: [],
})

export function importCsv(text: string, ctx: ImportContext): ImportPreview {
  const { headers, rows } = parseCsv(text)
  if (!rows.length) return { ...EMPTY('unknown', 0), warnings: ['The file looks empty — no data rows found.'] }

  const kind = detectKind(headers)
  if (kind === 'unknown') {
    return {
      ...EMPTY('unknown', rows.length),
      warnings: [
        `Could not recognise this file. Headers found: ${headers.join(', ')}.`,
        'Use one of the templates on this screen — orders need at least a date and a channel, production needs a perfume and a date.',
      ],
    }
  }
  if (kind === 'orders') return importOrders(rows, ctx)
  if (kind === 'production') return importProduction(rows, ctx)
  return importProducts(rows, ctx)
}

function importOrders(rows: Array<Record<string, string>>, ctx: ImportContext): ImportPreview {
  const out = EMPTY('orders', rows.length)
  const index = buildNameIndex(ctx.perfumes)
  const perfumes = [...ctx.perfumes]
  const packsByName = new Map(ctx.packs.map((p) => [norm(p.name), p]))
  const grouped = new Map<string, Array<Record<string, string>>>()
  let autoCode = 0

  for (const row of rows) {
    const code = pick(row, 'order_code', 'order', 'code', 'commande', 'n° commande', 'num', 'reference', 'ref')
    const key = code ? code.trim() : `__auto_${autoCode++}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }

  const customersById = new Map<string, Customer>()
  let seq = 1
  for (const [code, group] of grouped) {
    const first = group[0]
    const dateKey = toDayKey(pick(first, 'date', 'created_at', 'order_date', 'date commande')) ?? ctxDateFallback()
    const channel = mapChannel(pick(first, 'channel', 'canal', 'type de vente', 'vente'))
    if (!channel) {
      out.warnings.push(`Order ${code}: channel missing or unreadable ("${pick(first, 'channel') ?? ''}") — defaulted to LOCAL.`)
    }
    const effectiveChannel: Channel = channel ?? 'LOCAL'
    const status = mapStatus(pick(first, 'status', 'statut', 'etat'))
    const city = pick(first, 'city', 'ville', 'region', 'localisation') ?? 'Casablanca'
    const customerName = pick(first, 'customer_name', 'customer', 'client', 'nom', 'nom client') ?? `Client ${code}`
    const phone = pick(first, 'customer_phone', 'phone', 'telephone', 'tel', 'whatsapp') ?? ''
    // Phone is the primary key in this business (WhatsApp-driven); fall back to the name.
    const customerId = `C-${slugify(phone || customerName || `client-${code}`)}`

    // ── lines ──
    const items: Order['items'] = []
    for (const row of group) {
      const itemsText = pick(row, 'items', 'item', 'articles', 'produits', 'produit', 'perfume', 'parfum')
      const unitPrice = toNumber(pick(row, 'unit_price', 'prix', 'price', 'prix unitaire'))
      const qty = toNumber(pick(row, 'quantity', 'qty', 'quantite', 'qte')) ?? 1

      const lines: Array<{ name: string; qty: number }> = itemsText
        ? parseItemsText(itemsText)
        : [{ name: pick(row, 'perfume', 'parfum', 'produit') ?? '', qty }]

      for (const line of lines) {
        if (!line.name) continue
        const pack = packsByName.get(norm(line.name))
        if (pack) {
          items.push({
            kind: 'pack',
            refId: pack.id,
            name: pack.name,
            quantity: line.qty,
            unitPrice: unitPrice ?? pack.price,
            bottles: pack.items.reduce((s, c) => s + c.quantity, 0) * line.qty,
          })
          continue
        }
        const perfume = matchPerfume(line.name, index, perfumes)
        if (!perfume) {
          const created = makePerfumeFromName(line.name, { gender: 'unisex' })
          const id = perfumes.some((p) => p.id === created.id) ? `${created.id}-${seq}` : created.id
          const withId = { ...created, id }
          perfumes.push(withId)
          out.newPerfumes.push(withId)
          index.set(norm(withId.name), withId)
          items.push({
            kind: 'perfume',
            refId: withId.id,
            name: withId.name,
            quantity: line.qty,
            unitPrice: unitPrice ?? withId.localSinglePrice,
            bottles: line.qty,
          })
          continue
        }
        const price =
          unitPrice ??
          (effectiveChannel === 'LOCAL'
            ? line.qty >= 2
              ? perfume.localDuoPrice / line.qty
              : perfume.localSinglePrice
            : perfume.localSinglePrice)
        items.push({
          kind: 'perfume',
          refId: perfume.id,
          name: `${perfume.name} — ${perfume.brand}`,
          quantity: line.qty,
          unitPrice: price,
          bottles: line.qty,
        })
      }
    }

    if (!items.length) {
      out.warnings.push(`Order ${code}: no readable item — row skipped.`)
      continue
    }

    const grossFromItems = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const declared = toNumber(pick(first, 'gross_revenue', 'total', 'montant', 'revenue'))
    const grossRevenue = Math.round((declared ?? grossFromItems) * 100) / 100
    const productionCost =
      Math.round(
        items.reduce((s, it) => {
          if (it.kind === 'perfume') {
            const p = perfumes.find((x) => x.id === it.refId)
            return s + it.bottles * (p?.unitCost30ml ?? 12.81)
          }
          const pack = ctx.packs.find((x) => x.id === it.refId)
          if (!pack) return s + it.bottles * 12.81
          const perPack = pack.items.reduce(
            (sum, component) => sum + component.quantity * (perfumes.find((x) => x.id === component.perfumeId)?.unitCost30ml ?? 12.81),
            0,
          )
          return s + perPack * it.quantity
        }, 0) * 100,
      ) / 100
    const returned = status === 'returned' || Boolean(toNumber(pick(first, 'returned', 'retour')))
    const deliveryFee =
      effectiveChannel === 'ONLINE'
        ? toNumber(pick(first, 'delivery_fee', 'livraison', 'delivery')) ?? ctx.deliveryFee
        : 0
    const returnProvision =
      effectiveChannel === 'ONLINE'
        ? Math.round(grossRevenue * ctx.returnProvisionRate * 100) / 100
        : 0
    const orderType: OrderType = items.some((it) => it.kind === 'pack')
      ? 'PACK'
      : items.reduce((s, it) => s + it.bottles, 0) >= 2
        ? 'TWO_PACK'
        : 'SINGLE'

    if (effectiveChannel === 'ONLINE' && orderType !== 'PACK') {
      out.warnings.push(
        `Order ${code}: ONLINE order with single bottles — that breaks the channel rule (delivery kills the margin). Imported anyway, flagged.`,
      )
    }
    if (effectiveChannel === 'LOCAL' && orderType === 'PACK') {
      out.warnings.push(`Order ${code}: a pack sold on the LOCAL channel — imported, but packs are ONLINE-only in your rulebook.`)
    }

    const createdAt = `${dateKey}T${String(9 + (seq % 12)).padStart(2, '0')}:${String((seq * 7) % 60).padStart(2, '0')}:00.000Z`
    const cancelled = status === 'cancelled'
    // Return shipping only exists on the online channel — a local return costs nothing extra.
    const returnShipping = returned && effectiveChannel === 'ONLINE' ? 25 : 0
    const totalCost = cancelled ? 0 : Math.round((productionCost + deliveryFee + returnProvision + returnShipping) * 100) / 100
    const revenue = returned || cancelled ? 0 : grossRevenue

    out.orders.push({
      id: `IMP-${code}`,
      code: code.startsWith('__auto') ? `WAHJ-${String(9000 + seq)}` : code,
      channel: effectiveChannel,
      orderType,
      status,
      createdAt,
      customerId,
      city,
      items,
      deliveryFee,
      returnProvision,
      returned,
      returnShipping,
      grossRevenue,
      revenue,
      productionCost,
      totalCost,
      netProfit: cancelled ? 0 : Math.round((revenue - totalCost) * 100) / 100,
    })
    // customer roll-up so the Customers screen works with imported data too
    const bottlesInOrder = items.reduce((s, it) => s + it.bottles, 0)
    const prev = customersById.get(customerId)
    const counted = !cancelled
    customersById.set(customerId, {
      id: customerId,
      name: customerName,
      phone,
      city,
      channelAcquired: effectiveChannel,
      totalOrders: (prev?.totalOrders ?? 0) + (counted ? 1 : 0),
      totalSpent: Math.round(((prev?.totalSpent ?? 0) + (returned || cancelled ? 0 : grossRevenue)) * 100) / 100,
      bottlesThisCycle: counted ? ((prev?.bottlesThisCycle ?? 0) + bottlesInOrder) % 5 : prev?.bottlesThisCycle ?? 0,
      loyaltyRewards: (prev?.loyaltyRewards ?? 0) + (counted && (prev?.bottlesThisCycle ?? 0) + bottlesInOrder >= 5 ? 1 : 0),
      lastOrderAt: dateKey,
    })
    seq++
    void phone
  }

  out.perfumes = out.newPerfumes
  out.customers = [...customersById.values()]
  out.orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  out.info.push(`${out.orders.length} orders imported from ${rows.length} rows`)
  if (out.customers.length) out.info.push(`${out.customers.length} customers rolled up from those orders`)
  if (out.newPerfumes.length) {
    out.info.push(`${out.newPerfumes.length} new SKUs created: ${out.newPerfumes.slice(0, 6).map((p) => p.name).join(', ')}`)
  }
  const span = out.orders.length ? `${out.orders[0].createdAt.slice(0, 10)} → ${out.orders[out.orders.length - 1].createdAt.slice(0, 10)}` : ''
  if (span) out.info.push(`Date range detected: ${span}`)
  return out
}

function ctxDateFallback() {
  return dayKey(new Date())
}

function importProduction(rows: Array<Record<string, string>>, ctx: ImportContext): ImportPreview {
  const out = EMPTY('production', rows.length)
  const index = buildNameIndex(ctx.perfumes)

  rows.forEach((row, i) => {
    const rawName = pick(row, 'perfume', 'parfum', 'product', 'produit', 'name', 'nom')
    const produced = toDayKey(pick(row, 'production_date', 'date_production', 'date', 'made_on', 'fabrication'))
    const bottles = toNumber(pick(row, 'bottles', 'bouteilles', 'bottle_count', 'quantity', 'quantite', 'qte')) ?? 16
    if (!rawName || !produced) {
      out.warnings.push(`Row ${i + 2}: missing perfume name or production date — skipped.`)
      return
    }
    const perfume = matchPerfume(rawName, index, ctx.perfumes)
    if (!perfume) {
      out.warnings.push(`Row ${i + 2}: "${rawName}" is not in the catalogue — skipped (import your products CSV first).`)
      return
    }
    const readyDate = toDayKey(pick(row, 'ready_date', 'maceration_ready_date', 'date_prete', 'pret')) ?? dayKey(addDays(parseDay(produced), ctx.macerationDays))
    const statusRaw = normaliseKey(pick(row, 'status', 'statut', 'etat') ?? '')
    const remaining = toNumber(pick(row, 'bottles_remaining', 'restant', 'reste'))
    const status: ProductionBatch['status'] = statusRaw.includes('deplet') || statusRaw.includes('epuis')
      ? 'DEPLETED'
      : statusRaw.includes('instock') || statusRaw.includes('vendu') || statusRaw.includes('stock')
        ? 'IN_STOCK'
        : statusRaw.includes('ready') || statusRaw.includes('pret') || statusRaw.includes('confir')
          ? 'READY'
          : 'MACERATING'

    out.batches.push({
      id: `IMPB-${String(i + 1).padStart(4, '0')}`,
      code: pick(row, 'batch', 'lot', 'code') ?? `BIM-${String(i + 1).padStart(3, '0')}`,
      perfumeId: perfume.id,
      productionDate: produced,
      readyDate,
      bottleCount: Math.round(bottles),
      bottlesRemaining: Math.round(remaining ?? bottles),
      status,
      salesStartedAt: status === 'IN_STOCK' ? readyDate : null,
      costPerBatch: Math.round(perfume.unitCost30ml * bottles * 100) / 100,
      costPerBottle: perfume.unitCost30ml,
    })
  })

  out.info.push(`${out.batches.length} production batches imported`)
  const withStock = out.batches.filter((b) => b.status === 'IN_STOCK').length
  if (withStock) out.info.push(`${withStock} arrive with sellable stock`)
  if (!out.batches.some((b) => b.status === 'IN_STOCK') && out.batches.length) {
    out.warnings.push('No batch has status IN_STOCK — the stock screens will show zero sellable bottles until you confirm batches.')
  }
  return out
}

function importProducts(rows: Array<Record<string, string>>, ctx: ImportContext): ImportPreview {
  const out = EMPTY('products', rows.length)
  const existing = buildNameIndex(ctx.perfumes)

  rows.forEach((row, i) => {
    const rawName = pick(row, 'name', 'perfume', 'parfum', 'produit', 'product', 'nom')
    if (!rawName) {
      out.warnings.push(`Row ${i + 2}: no product name — skipped.`)
      return
    }
    const brand = pick(row, 'brand', 'marque', 'maison') ?? ''
    const known = matchPerfume(brand ? `${rawName} ${brand}` : rawName, existing, ctx.perfumes)
    const oilCost = toNumber(pick(row, 'oil_cost', 'cout_huile', 'huile', 'cost'))
    const bottleCost = toNumber(pick(row, 'bottle_cost', 'cout_flacon'))
    const labelCost = toNumber(pick(row, 'label_cost', 'cout_etiquette'))
    const bottlesPerBatch = toNumber(pick(row, 'bottles_per_batch', 'bouteilles_par_lot', 'bottles'))
    const alcoholPrice = toNumber(pick(row, 'alcohol_price_per_liter', 'prix_alcool'))
    const recipe = {
      ...(known?.recipe ?? BASE_RECIPE),
      ...(oilCost !== null ? { oilCost } : {}),
      ...(bottleCost !== null ? { bottleCost } : {}),
      ...(labelCost !== null ? { labelCost } : {}),
      ...(bottlesPerBatch !== null ? { bottlesPerBatch: Math.round(bottlesPerBatch) } : {}),
      ...(alcoholPrice !== null ? { alcoholPricePerLiter: alcoholPrice } : {}),
    }
    const cost = calculateBatchCost(recipe)
    const single = toNumber(pick(row, 'local_single_price', 'price', 'prix', 'prix_30ml', 'prix_vente'))
    const duo = toNumber(pick(row, 'local_duo_price', 'prix_duo', 'duo'))

    const base = known ?? makePerfumeFromName(brand ? `${rawName} — ${brand}` : rawName)
    out.perfumes.push({
      ...base,
      id: base.id,
      name: rawName,
      brand: brand || base.brand,
      gender: mapGender(pick(row, 'gender', 'genre', 'sexe')) ?? base.gender,
      family: pick(row, 'family', 'famille', 'notes', 'olffactive') ?? base.family,
      abcClass: mapClass(pick(row, 'abc_class', 'class', 'classe', 'abc')) ?? base.abcClass,
      status: (normaliseKey(pick(row, 'status', 'statut') ?? '') .includes('drop') ? 'dropped' : base.status) as Perfume['status'],
      recipe,
      unitCost30ml: Math.round(cost.perBottle * 100) / 100,
      localSinglePrice: single !== null ? single : base.localSinglePrice,
      localDuoPrice: duo !== null ? duo : base.localDuoPrice,
    })
  })

  out.info.push(`${out.perfumes.length} products mapped (unit cost recalculated from each recipe)`)
  const missing = rows.length - out.perfumes.length
  if (missing > 0) out.warnings.push(`${missing} row(s) skipped`)
  return out
}

// ── Templates & export ──────────────────────────────────────────────────────
export const TEMPLATES: Record<ImportKind, { label: string; columns: string[]; example: Array<Record<string, string>>; hint: string }> = {
  orders: {
    label: 'Orders',
    columns: [
      'order_code',
      'date',
      'channel',
      'status',
      'customer_name',
      'customer_phone',
      'city',
      'items',
      'gross_revenue',
      'delivery_fee',
      'returned',
    ],
    example: [
      {
        order_code: 'WAHJ-2601',
        date: '2026-09-24',
        channel: 'LOCAL',
        status: 'delivered',
        customer_name: 'Salma Bennani',
        customer_phone: '0661 22 33 44',
        city: 'Casablanca',
        items: '2× Yara; 1× Khamrah',
        gross_revenue: '187',
        delivery_fee: '0',
        returned: '0',
      },
      {
        order_code: 'WAHJ-2602',
        date: '2026-09-25',
        channel: 'ONLINE',
        status: 'shipped',
        customer_name: 'Youssef El Idrissi',
        customer_phone: '0712 55 66 77',
        city: 'Marrakech-Safi',
        items: '1× Pack Parfait — Elle',
        gross_revenue: '269',
        delivery_fee: '35',
        returned: '0',
      },
    ],
    hint: 'One row per order line, or one row per order. Channel accepts LOCAL/ONLINE, local/boutique, online/colis/livraison.',
  },
  production: {
    label: 'Production / maceration log',
    columns: ['perfume', 'production_date', 'bottles', 'status', 'ready_date', 'bottles_remaining', 'batch'],
    example: [
      { perfume: 'Khamrah', production_date: '2026-09-10', bottles: '16', status: 'IN_STOCK', ready_date: '2026-09-24', bottles_remaining: '11', batch: 'B1291' },
      { perfume: 'Sauvage', production_date: '2026-09-20', bottles: '16', status: 'MACERATING', ready_date: '', bottles_remaining: '16', batch: 'B1302' },
    ],
    hint: 'Ready date is calculated as production date + 14 days when you leave it empty. Status: MACERATING / READY / IN_STOCK / DEPLETED.',
  },
  products: {
    label: 'Catalogue',
    columns: ['name', 'brand', 'gender', 'abc_class', 'oil_cost', 'bottles_per_batch', 'local_single_price', 'local_duo_price'],
    example: [
      { name: 'Sauvage', brand: 'Dior', gender: 'men', abc_class: 'A', oil_cost: '110', bottles_per_batch: '16', local_single_price: '49', local_duo_price: '89' },
      { name: 'Khamrah', brand: 'Lattafa', gender: 'unisex', abc_class: 'A', oil_cost: '112', bottles_per_batch: '16', local_single_price: '49', local_duo_price: '89' },
    ],
    hint: 'Unit cost is always recalculated: (oil + alcohol + bottles + labels) ÷ bottles per batch.',
  },
}

export function templateCsv(kind: ImportKind): string {
  const t = TEMPLATES[kind]
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [t.columns.join(','), ...t.example.map((r) => t.columns.map((c) => escape(r[c] ?? '')).join(','))].join('\n')
}

/** Exports the live dataset in the exact shape the importer reads — edit in Excel, re-import. */
export function ordersToCsv(orders: Order[], nameOf?: (customerId: string) => string, phoneOf?: (customerId: string) => string): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const header = TEMPLATES.orders.columns.join(',')
  const rows = orders.map((o) =>
    [
      o.code,
      o.createdAt.slice(0, 10),
      o.channel,
      o.status,
      (nameOf ? nameOf(o.customerId) : o.customerId).replace(/,/g, ' '),
      phoneOf ? phoneOf(o.customerId).replace(/,/g, ' ') : '',
      o.city.replace(/,/g, ' '),
      o.items.map((it) => `${it.quantity}× ${it.name}`).join('; '),
      String(o.grossRevenue),
      String(o.deliveryFee),
      o.returned ? '1' : '0',
    ]
      .map(escape)
      .join(','),
  )
  return [header, ...rows].join('\n')
}

export function batchesToCsv(batches: ProductionBatch[], nameOf: (id: string) => string): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const header = TEMPLATES.production.columns.join(',')
  const rows = batches.map((b) =>
    [nameOf(b.perfumeId), b.productionDate, String(b.bottleCount), b.status, b.readyDate, String(b.bottlesRemaining), b.code]
      .map(escape)
      .join(','),
  )
  return [header, ...rows].join('\n')
}

export const demandWeightFor = (id: string) => DEMAND_WEIGHT[id] ?? 1
