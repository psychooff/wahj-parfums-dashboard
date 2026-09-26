import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildDataset, getStockRows } from '../data/generate'
import { importCsv, type ImportContext, type ImportKind, type ImportPreview } from '../lib/importer'
import { RULES } from '../data/catalog'
import type {
  ABCClass,
  Channel,
  Dataset,
  Filters,
  Gender,
  Order,
  ProductionBatch,
  RangePreset,
  Settings,
  StockRow,
} from '../lib/types'
import {
  activityHeatmap,
  bucketOrders,
  buildPnL,
  channelSplit,
  citySplit,
  classSplit,
  computeKpis,
  filterOrders,
  packStats,
  perfumeStats,
  pickGranularity,
  presetRange,
  previousRange,
  stockValue,
  type Bucket,
  type FilterContext,
  type Granularity,
  type Kpis,
  type PnL,
  type PerfumeStat,
  type SplitRow,
} from '../lib/metrics'
import { addDays, dayKey, daysBetween, formatDateLong, parseDay, startOfDay } from '../lib/dates'
import { useTheme } from '../lib/theme'

/** Built once per session — same seed, same business. */
const DATASET: Dataset = buildDataset()

function economy(o: Order, settings: Settings): Order {
  const deliveryFee = o.channel === 'ONLINE' ? settings.deliveryFee : 0
  const returnProvision = o.channel === 'ONLINE' ? Math.round(o.grossRevenue * settings.returnProvisionRate * 100) / 100 : 0
  const cancelled = o.status === 'cancelled'
  const returned = o.status === 'returned'
  const revenue = returned || cancelled ? 0 : o.grossRevenue
  const totalCost = cancelled ? 0 : Math.round((o.productionCost + deliveryFee + returnProvision + o.returnShipping) * 100) / 100
  return {
    ...o,
    deliveryFee,
    returnProvision,
    revenue,
    totalCost,
    netProfit: cancelled ? 0 : Math.round((revenue - totalCost) * 100) / 100,
  }
}

export interface ImportLogEntry {
  at: string
  kind: ImportKind | 'unknown'
  rows: number
  info: string[]
  warnings: string[]
}

export interface DashboardValue {
  dataset: Dataset
  ctx: FilterContext
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  resetSettings: () => void

  filters: Filters
  setPreset: (preset: RangePreset) => void
  setCustomRange: (from: string, to: string) => void
  toggleChannel: (c: Channel) => void
  toggleClass: (c: ABCClass) => void
  toggleGender: (g: Gender) => void
  setChannels: (c: Channel[]) => void
  setClasses: (c: ABCClass[]) => void
  setGenders: (g: Gender[]) => void
  resetFilters: () => void
  activeFilterCount: number

  /** Orders inside the current range + segments, with live economics applied. */
  orders: Order[]
  prevOrders: Order[]
  granularity: Granularity
  rangeDays: number
  prevRange: { from: string; to: string }

  kpis: Kpis
  prevKpis: Kpis
  buckets: Bucket[]
  prevBuckets: Bucket[]
  pnl: PnL
  channelRows: SplitRow[]
  cityRows: SplitRow[]
  classRows: SplitRow[]
  perfumes: PerfumeStat[]
  packs: ReturnType<typeof packStats>
  heatmap: number[][]
  stock: StockRow[]
  stockSummary: { sellableBottles: number; maceratingBottles: number; value: number }
  openAlerts: StockRow[]
  batches: ProductionBatch[]
  /** 'sample' until the founder imports their own files. */
  dataSource: 'sample' | 'imported'
  importLog: ImportLogEntry[]
  applyImport: (preview: ImportPreview) => void
  resetToSampleData: () => void
  /** Move a READY batch into sellable stock (the human confirmation step). */
  confirmBatch: (batchId: string) => void
  /** Start a new production run — ready date is calculated, never typed. */
  createBatch: (perfumeId: string, bottleCount: number, productionDate: string) => void
  lastAction: string | null

  theme: 'dark' | 'light'
  toggleTheme: () => void
  /** True for a beat after a filter change — drives the "refreshing" animation. */
  refreshing: boolean
  lastUpdated: Date
}

const DashboardContext = createContext<DashboardValue | null>(null)

const DEFAULT_FILTERS = (): Filters => ({
  preset: '30d',
  from: presetRange('30d', DATASET.historyStart, DATASET.historyEnd).from,
  to: DATASET.historyEnd,
  channels: ['LOCAL', 'ONLINE'],
  classes: ['A', 'B', 'C'],
  genders: ['men', 'women', 'unisex'],
})

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { mode, toggle: toggleTheme } = useTheme()
  const [settings, setSettings] = useState<Settings>(RULES)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [dataset, setDataset] = useState<Dataset>(DATASET)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [importLog, setImportLog] = useState<ImportLogEntry[]>([])
  const [dataSource, setDataSource] = useState<'sample' | 'imported'>('sample')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const firstRender = useRef(true)

  const ctx: FilterContext = useMemo(
    () => ({
      packsById: new Map(dataset.packs.map((p) => [p.id, p])),
      perfumesById: new Map(dataset.perfumes.map((p) => [p.id, p])),
    }),
    [dataset.packs, dataset.perfumes],
  )

  const pricedOrders = useMemo(() => dataset.orders.map((o) => economy(o, settings)), [dataset.orders, settings])

  const firstOrderByCustomer = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of pricedOrders) {
      const k = dayKey(o.createdAt)
      if (!map.has(o.customerId) || k < map.get(o.customerId)!) map.set(o.customerId, k)
    }
    return map
  }, [pricedOrders])

  // ── Range + segments ──────────────────────────────────────────────────────
  const rangeDays = useMemo(() => daysBetween(parseDay(filters.from), parseDay(filters.to)) + 1, [filters.from, filters.to])
  const prevRange = useMemo(() => previousRange(filters.from, filters.to), [filters.from, filters.to])

  const orders = useMemo(() => filterOrders(pricedOrders, filters, ctx), [pricedOrders, filters, ctx])
  const prevOrders = useMemo(() => filterOrders(pricedOrders, filters, ctx, prevRange), [pricedOrders, filters, ctx, prevRange])

  const granularity = useMemo(() => pickGranularity(filters.from, filters.to), [filters.from, filters.to])

  const kpis = useMemo(() => computeKpis(orders, firstOrderByCustomer), [orders, firstOrderByCustomer])
  const prevKpis = useMemo(() => computeKpis(prevOrders, firstOrderByCustomer), [prevOrders, firstOrderByCustomer])

  const buckets = useMemo(
    () => bucketOrders(orders, granularity, { fill: true, from: filters.from, to: filters.to }),
    [orders, granularity, filters.from, filters.to],
  )
  const prevBuckets = useMemo(() => bucketOrders(prevOrders, granularity), [prevOrders, granularity])

  const pnl = useMemo(() => buildPnL(orders), [orders])
  const channelRows = useMemo(() => channelSplit(orders), [orders])
  const cityRows = useMemo(() => citySplit(orders), [orders])
  const perfumes = useMemo(() => perfumeStats(orders, ctx), [orders, ctx])
  const classRows = useMemo(() => classSplit(perfumes), [perfumes])
  const packs = useMemo(() => packStats(orders, ctx), [orders, ctx])
  const heatmap = useMemo(() => activityHeatmap(orders), [orders])

  // Stock is "right now" — it reacts to class/gender segments, never to date presets.
  const batches = dataset.batches
  const stockAll = useMemo(() => getStockRows(dataset, dataset.batches), [dataset])
  const stock = useMemo(
    () =>
      stockAll.filter(
        (row) => filters.classes.includes(row.perfume.abcClass) && (filters.genders as string[]).includes(row.perfume.gender),
      ),
    [stockAll, filters.classes, filters.genders],
  )
  const stockSummary = useMemo(
    () =>
      stockValue(
        dataset.batches.filter((b) => {
          const p = ctx.perfumesById.get(b.perfumeId)
          return p && filters.classes.includes(p.abcClass) && (filters.genders as string[]).includes(p.gender)
        }),
        ctx.perfumesById,
      ),
    [ctx, filters.classes, filters.genders, dataset.batches],
  )
  const openAlerts = useMemo(
    () => stock.filter((s) => s.reorderStatus !== 'ok').sort((a, b) => a.sellable - b.sellable),
    [stock],
  )

  // ── Actions ───────────────────────────────────────────────────────────────
  const setPreset = useCallback((preset: RangePreset) => {
    setFilters((f) => ({ ...f, preset, ...presetRange(preset, DATASET.historyStart, DATASET.historyEnd) }))
  }, [])

  const setCustomRange = useCallback((from: string, to: string) => {
    setFilters((f) => ({ ...f, preset: 'custom', from: from <= to ? from : to, to: from <= to ? to : from }))
  }, [])

  const toggleIn = <T,>(list: T[], value: T, all: T[]): T[] => {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    return next.length === 0 ? all : next
  }

  const toggleChannel = useCallback((c: Channel) => setFilters((f) => ({ ...f, channels: toggleIn(f.channels, c, ['LOCAL', 'ONLINE']) })), [])
  const toggleClass = useCallback((c: ABCClass) => setFilters((f) => ({ ...f, classes: toggleIn(f.classes, c, ['A', 'B', 'C']) })), [])
  const toggleGender = useCallback(
    (g: Gender) => setFilters((f) => ({ ...f, genders: toggleIn(f.genders, g, ['men', 'women', 'unisex']) })),
    [],
  )

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS()), [])

  const activeFilterCount =
    (filters.channels.length !== 2 ? 1 : 0) +
    (filters.classes.length !== 3 ? 1 : 0) +
    (filters.genders.length !== 3 ? 1 : 0) +
    (filters.preset !== '30d' ? 1 : 0)

  const confirmBatch = useCallback(
    (batchId: string) => {
      setDataset((d) => ({
        ...d,
        batches: d.batches.map((b) =>
          b.id === batchId && (b.status === 'READY' || b.status === 'MACERATING')
            ? { ...b, status: 'IN_STOCK', salesStartedAt: dayKey(new Date()) }
            : b,
        ),
      }))
      const batch = dataset.batches.find((b) => b.id === batchId)
      setLastAction(
        batch
          ? `${batch.code} confirmed → ${batch.bottlesRemaining} bottles moved into sellable stock`
          : 'Batch confirmed into sellable stock',
      )
    },
    [dataset.batches],
  )

  const createBatch = useCallback(
    (perfumeId: string, bottleCount: number, productionDate: string) => {
      const perfume = ctx.perfumesById.get(perfumeId)
      if (!perfume) return
      const readyDate = dayKey(addDays(parseDay(productionDate), settings.macerationDays))
      setDataset((d) => {
        const prev = d.batches
        const seq = prev.length + 1
        const batch: ProductionBatch = {
          id: `BAT-N${String(seq).padStart(4, '0')}`,
          code: `B${String(2000 + seq)}`,
          perfumeId,
          productionDate,
          readyDate,
          bottleCount,
          bottlesRemaining: bottleCount,
          status: 'MACERATING',
          salesStartedAt: null,
          costPerBatch: Math.round(perfume.unitCost30ml * bottleCount * 100) / 100,
          costPerBottle: perfume.unitCost30ml,
        }
        return { ...d, batches: [batch, ...prev] }
      })
      setLastAction(
        `New batch: ${perfume.name} × ${bottleCount} bottles — macerating until ${formatDateLong(readyDate)} (${settings.macerationDays} days)`,
      )
    },
    [ctx, settings.macerationDays],
  )

  // ── CSV import ────────────────────────────────────────────────────────────
  const applyImport = useCallback(
    (preview: ImportPreview) => {
      if (!preview.rowCount || preview.kind === 'unknown') return
      setDataset((d) => {
        const next: Dataset = { ...d }

        if (preview.kind === 'orders' && preview.orders.length) {
          next.orders = preview.orders
          if (preview.customers.length) next.customers = preview.customers
          if (preview.newPerfumes.length) {
            const known = new Set(d.perfumes.map((p) => p.id))
            next.perfumes = [...d.perfumes, ...preview.newPerfumes.filter((p) => !known.has(p.id))]
          }
          const dates = preview.orders.map((o) => o.createdAt.slice(0, 10)).sort()
          next.historyStart = dates[0]
          next.historyEnd = dates[dates.length - 1]
        }
        if (preview.kind === 'production' && preview.batches.length) {
          next.batches = preview.batches
        }
        if (preview.kind === 'products' && preview.perfumes.length) {
          next.perfumes = preview.perfumes
        }
        return next
      })

      if (preview.kind === 'orders' && preview.orders.length) {
        const dates = preview.orders.map((o) => o.createdAt.slice(0, 10)).sort()
        setFilters((f) => ({ ...f, preset: 'custom', from: dates[0], to: dates[dates.length - 1] }))
      }

      setDataSource('imported')
      setImportLog((log) => [
        {
          at: new Date().toISOString(),
          kind: preview.kind,
          rows: preview.rowCount,
          info: preview.info,
          warnings: preview.warnings,
        },
        ...log,
      ])
      setLastAction(
        `Import applied — ${preview.kind} (${preview.rowCount} rows). Every screen now reads your data.`,
      )
    },
    [],
  )

  const resetToSampleData = useCallback(() => {
    setDataset(DATASET)
    setDataSource('sample')
    setImportLog([])
    setFilters(DEFAULT_FILTERS())
    setLastAction('Back to the generated sample dataset')
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [])
  const resetSettings = useCallback(() => setSettings(RULES), [])

  // ── Repo data auto-load ───────────────────────────────────────────────────
  // Any CSV committed to public/data/ is picked up on boot: catalogue first,
  // then the production log, then orders. Drop a file in, reload, done.
  const repoLoaded = useRef(false)
  useEffect(() => {
    if (repoLoaded.current) return
    repoLoaded.current = true
    let cancelled = false

    const readCsv = async (name: string): Promise<string | null> => {
      try {
        const res = await fetch(`data/${name}`, { cache: 'no-store' })
        if (!res.ok) return null
        const type = res.headers.get('content-type') ?? ''
        if (type.includes('text/html')) return null // SPA fallback, file not present
        const text = await res.text()
        if (!text.trim() || text.trim().startsWith('<')) return null
        return text
      } catch {
        return null
      }
    }

    ;(async () => {
      const order: Array<{ names: string[]; expect: 'products' | 'production' | 'orders' }> = [
        { names: ['catalogue.csv', 'products.csv'], expect: 'products' },
        { names: ['production.csv', 'batches.csv'], expect: 'production' },
        { names: ['orders.csv', 'ventes.csv'], expect: 'orders' },
      ]
      const ctxNow: ImportContext = {
        perfumes: DATASET.perfumes,
        packs: DATASET.packs,
        deliveryFee: settings.deliveryFee,
        returnProvisionRate: settings.returnProvisionRate,
        macerationDays: settings.macerationDays,
      }
      const applied: string[] = []
      for (const step of order) {
        for (const name of step.names) {
          const text = await readCsv(name)
          if (!text) continue
          const preview = importCsv(text, ctxNow)
          if (cancelled || preview.kind === 'unknown' || !preview.rowCount) continue
          applyImport(preview)
          applied.push(`${name} (${preview.kind}, ${preview.rowCount} rows)`)
          break
        }
      }
      if (applied.length && !cancelled) {
        setLastAction(`Loaded from public/data/ — ${applied.join(' · ')}. Replace a file and reload to refresh.`)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applyImport, settings.deliveryFee, settings.returnProvisionRate, settings.macerationDays])

  // Small, honest "live data" beat: when a filter moves, everything eases in again.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setRefreshing(true)
    setLastUpdated(new Date())
    const t = window.setTimeout(() => setRefreshing(false), 260)
    return () => window.clearTimeout(t)
  }, [filters, settings, dataset])

  const value: DashboardValue = {
    dataset: DATASET,
    ctx,
    settings,
    updateSettings,
    resetSettings,
    filters,
    setPreset,
    setCustomRange,
    toggleChannel,
    toggleClass,
    toggleGender,
    setChannels: (channels) => setFilters((f) => ({ ...f, channels })),
    setClasses: (classes) => setFilters((f) => ({ ...f, classes })),
    setGenders: (genders) => setFilters((f) => ({ ...f, genders })),
    resetFilters,
    activeFilterCount,
    orders,
    prevOrders,
    granularity,
    rangeDays,
    prevRange,
    kpis,
    prevKpis,
    buckets,
    prevBuckets,
    pnl,
    channelRows,
    cityRows,
    classRows,
    perfumes,
    packs,
    heatmap,
    stock,
    stockSummary,
    openAlerts,
    batches,
    dataSource,
    importLog,
    applyImport,
    resetToSampleData,
    confirmBatch,
    createBatch,
    lastAction,
    theme: mode,
    toggleTheme,
    refreshing,
    lastUpdated,
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside <DashboardProvider>')
  return ctx
}

export const TODAY = startOfDay(new Date())
