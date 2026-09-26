import { useMemo, useState } from 'react'
import { useDashboard } from '../state/store'
import { FilterBar } from '../components/FilterBar'
import { ChartCard, SegmentedControl, StatusPill } from '../components/ChartCard'
import { DataTable, type Column } from '../components/DataTable'
import { NoteCard } from '../components/NoteCard'
import { PackEconomicsBars, PackMarginScatter, PerfumeRevenueChart } from '../charts/ProductCharts'
import { packCost } from '../data/generate'
import { formatDH, formatNumber } from '../lib/dates'
import { RULES } from '../data/catalog'
import type { Perfume, ProductionBatch } from '../lib/types'
import type { PerfumeStat } from '../lib/metrics'

const CLASS_HINT: Record<string, string> = { A: 'hero', B: 'steady', C: 'long tail' }

export function Products() {
  const { perfumes, packs, theme, ctx, dataset, filters } = useDashboard()
  const [tab, setTab] = useState<'skus' | 'packs'>('skus')
  const [rankMetric, setRankMetric] = useState<'revenue' | 'profit' | 'bottles' | 'orders'>('revenue')

  const perfumeRows = useMemo(() => {
    const statsById = new Map(perfumes.map((p) => [p.perfume.id, p]))
    return dataset.perfumes.map((perfume) => {
      const stat = statsById.get(perfume.id)
      const batches = dataset.batches.filter((b) => b.perfumeId === perfume.id)
      const sellable = batches.filter((b) => b.status === 'IN_STOCK').reduce((s, b) => s + b.bottlesRemaining, 0)
      const macerating = batches
        .filter((b) => b.status === 'MACERATING' || b.status === 'READY')
        .reduce((s, b) => s + b.bottlesRemaining, 0)
      const cost = perfume.unitCost30ml
      return {
        perfume,
        revenue: stat?.revenue ?? 0,
        profit: stat?.profit ?? 0,
        bottles: stat?.bottles ?? 0,
        orders: stat?.orders ?? 0,
        margin: stat && stat.revenue > 0 ? (stat.profit / stat.revenue) * 100 : 0,
        sellable,
        macerating,
        batches,
        unitMargin: (perfume.localSinglePrice - cost) / perfume.localSinglePrice,
      }
    })
  }, [perfumes, dataset])

  const packRows = useMemo(
    () =>
      dataset.packs.map((pack) => {
        const econ = packCost(pack, ctx.perfumesById)
        const stat = packs.find((p) => p.pack.id === pack.id)
        return {
          pack,
          econ,
          units: stat?.units ?? 0,
          revenue: stat?.revenue ?? 0,
          profit: stat?.profit ?? 0,
          marginPct: stat && stat.revenue > 0 ? (stat.profit / stat.revenue) * 100 : econ.margin,
        }
      }),
    [dataset.packs, ctx, packs],
  )

  const skuColumns: Column<(typeof perfumeRows)[number]>[] = [
    {
      key: 'name',
      header: 'Perfume',
      sortValue: (r) => r.perfume.name,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.perfume.name}</span>
          <span className="text-[10.5px] text-wahj-smoke">
            {r.perfume.brand} · {r.perfume.family}
          </span>
        </span>
      ),
    },
    {
      key: 'gender',
      header: 'Audience',
      sortValue: (r) => r.perfume.gender,
      render: (r) => <span className="capitalize text-wahj-smoke">{r.perfume.gender}</span>,
    },
    {
      key: 'class',
      header: 'Class',
      sortValue: (r) => r.perfume.abcClass,
      render: (r) => (
        <StatusPill tone={r.perfume.abcClass === 'A' ? 'info' : 'neutral'}>
          {r.perfume.abcClass} · {CLASS_HINT[r.perfume.abcClass]}
        </StatusPill>
      ),
    },
    {
      key: 'unitCost',
      header: 'Unit cost',
      align: 'right',
      sortValue: (r) => r.perfume.unitCost30ml,
      csv: (r) => r.perfume.unitCost30ml.toFixed(2),
      render: (r) => <span className="tnum">{formatDH(r.perfume.unitCost30ml, { decimals: 2 })}</span>,
    },
    {
      key: 'localPrice',
      header: 'Local price',
      align: 'right',
      sortValue: (r) => r.perfume.localSinglePrice,
      render: (r) => (
        <span className="tnum">
          {formatDH(r.perfume.localSinglePrice)}
          <span className="ml-1 text-[10px] text-wahj-smoke">/ {formatDH(r.perfume.localDuoPrice)} duo</span>
        </span>
      ),
    },
    {
      key: 'unitMargin',
      header: 'Unit margin',
      align: 'right',
      sortValue: (r) => r.unitMargin,
      render: (r) => <span className="tnum text-pos">{(r.unitMargin * 100).toFixed(1)}%</span>,
    },
    {
      key: 'bottles',
      header: 'Bottles sold',
      align: 'right',
      sortValue: (r) => r.bottles,
      render: (r) => <span className="tnum">{formatNumber(r.bottles)}</span>,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortValue: (r) => r.revenue,
      render: (r) => <span className="tnum font-medium">{formatDH(Math.round(r.revenue))}</span>,
    },
    {
      key: 'profit',
      header: 'Gross profit',
      align: 'right',
      sortValue: (r) => r.profit,
      render: (r) => <span className="tnum text-pos">{formatDH(Math.round(r.profit))}</span>,
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortValue: (r) => r.margin,
      render: (r) => <span className="tnum">{r.margin.toFixed(0)}%</span>,
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      sortValue: (r) => r.sellable,
      render: (r) => (
        <span className="tnum">
          <span className={r.sellable < RULES.reorderTriggers[r.perfume.abcClass] ? 'text-warn' : ''}>{r.sellable}</span>
          <span className="text-wahj-smoke"> sell / {r.macerating} cook</span>
        </span>
      ),
    },
  ]

  const packColumns: Column<(typeof packRows)[number]>[] = [
    {
      key: 'name',
      header: 'Pack',
      sortValue: (r) => r.pack.name,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.pack.name}</span>
          <span className="text-[10.5px] text-wahj-smoke">
            {r.pack.items.length} bottles · {r.pack.items.filter((i) => i.isFreeGift).length} free gift · {r.pack.gender}
          </span>
        </span>
      ),
    },
    { key: 'price', header: 'Price', align: 'right', sortValue: (r) => r.pack.price, render: (r) => <span className="tnum">{formatDH(r.pack.price)}</span> },
    {
      key: 'production',
      header: 'Production',
      align: 'right',
      sortValue: (r) => r.econ.production,
      render: (r) => <span className="tnum text-wahj-smoke">{formatDH(r.econ.production)}</span>,
    },
    {
      key: 'delivery',
      header: 'Delivery',
      align: 'right',
      sortValue: (r) => r.econ.delivery,
      render: (r) => <span className="tnum text-wahj-smoke">{formatDH(r.econ.delivery)}</span>,
    },
    {
      key: 'provision',
      header: 'Return prov.',
      align: 'right',
      sortValue: (r) => r.econ.provision,
      render: (r) => <span className="tnum text-wahj-smoke">{formatDH(Math.round(r.econ.provision))}</span>,
    },
    {
      key: 'profit',
      header: 'Profit / unit',
      align: 'right',
      sortValue: (r) => r.econ.profit,
      render: (r) => (
        <span className={`tnum font-medium ${r.econ.profit >= 0 ? 'text-pos' : 'text-neg'}`}>{formatDH(Math.round(r.econ.profit))}</span>
      ),
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortValue: (r) => r.econ.margin,
      render: (r) => (
        <span className={`tnum ${r.econ.margin < 25 ? 'text-warn' : r.econ.margin < 45 ? '' : 'text-pos'}`}>{r.econ.margin.toFixed(1)}%</span>
      ),
    },
    {
      key: 'units',
      header: 'Units sold',
      align: 'right',
      sortValue: (r) => r.units,
      render: (r) => <span className="tnum">{formatNumber(r.units)}</span>,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortValue: (r) => r.revenue,
      render: (r) => <span className="tnum">{formatDH(Math.round(r.revenue))}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <FilterBar />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'skus', label: 'Individual perfumes' },
            { value: 'packs', label: 'Packs (online only)' },
          ]}
        />
        <span className="text-[11px] text-wahj-smoke">
          {tab === 'skus'
            ? `${dataset.perfumes.length} SKUs · unit cost derived from the live batch recipe`
            : `${dataset.packs.length} packs · 4 paid + 1 free unless it's a discovery pack`}
        </span>
      </div>

      {tab === 'skus' ? (
        <>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="SKU leaderboard"
              subtitle="Revenue vs gross profit — the gap is production cost"
              actions={
                <SegmentedControl
                  size="sm"
                  value={rankMetric}
                  onChange={setRankMetric}
                  options={[
                    { value: 'revenue', label: 'Rev' },
                    { value: 'profit', label: 'Profit' },
                    { value: 'bottles', label: 'Bottles' },
                  ]}
                />
              }
            >
              <PerfumeRevenueChart rows={perfumes} mode={theme} limit={10} />
            </ChartCard>
            <ChartCard title="What to refill next" subtitle="Ranked by bottles sold in the selected range">
              <div className="space-y-3">
                {[...perfumes]
                  .sort((a, b) => b.bottles - a.bottles)
                  .slice(0, 8)
                  .map((s: PerfumeStat, i) => (
                    <div key={s.perfume.id} className="flex items-center gap-3">
                      <span className="w-5 text-right text-[11px] text-wahj-smoke tnum">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{s.perfume.name}</span>
                        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-wahj-ember to-wahj-bright transition-[width] duration-700 ease-smooth"
                            style={{ width: `${(s.bottles / Math.max(1, perfumes[0]?.bottles ?? 1)) * 100}%` }}
                          />
                        </span>
                      </span>
                      <span className="w-14 text-right text-xs tnum">{s.bottles} bt</span>
                    </div>
                  ))}
              </div>
            </ChartCard>
          </div>

          <ChartCard
            title="Catalog"
            subtitle="Sortable, searchable, exportable — unit cost recalculates from the batch recipe, it is never typed by hand"
            bodyClassName="!px-0 !pb-0"
          >
            <DataTable
              rows={perfumeRows}
              columns={skuColumns}
              rowKey={(r) => r.perfume.id}
              initialSort={{ key: 'revenue', dir: 'desc' }}
              searchPlaceholder="Search perfume, brand, family…"
              searchText={(r) => `${r.perfume.name} ${r.perfume.brand} ${r.perfume.family} ${r.perfume.abcClass} ${r.perfume.gender}`}
              csvName="wahj-catalog.csv"
              pageSize={10}
              renderExpanded={(r) => <BatchDetail batches={r.batches} perfume={r.perfume} />}
            />
          </ChartCard>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Where the pack price goes"
              subtitle={`Production + ${formatDH(RULES.deliveryFee)} delivery absorbed + ${(RULES.returnProvisionRate * 100).toFixed(0)}% return provision vs. what you keep`}
              footer={<span>Raise a pack price only after checking this bar — the 5th bottle is free, but it still costs production.</span>}
            >
              <PackEconomicsBars rows={packRows.map((r) => ({ name: r.pack.name.replace('Pack ', ''), ...r.econ }))} mode={theme} />
            </ChartCard>
            <ChartCard
              title="Pack price vs. margin"
              subtitle="Bubble size = units sold in the selected range"
              footer={<span>Anything under 25% margin is fragile: one return wipes out two sales.</span>}
            >
              <PackMarginScatter
                rows={packRows.map((r) => ({ name: r.pack.name, price: r.pack.price, margin: r.econ.margin, units: r.units, profit: r.econ.profit }))}
                mode={theme}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {packRows.map((r, i) => (
              <article key={r.pack.id} className="card card-pad animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-arabic text-[11px] text-wahj-gold/80">{r.pack.nameAr}</p>
                    <h3 className="mt-0.5 font-display text-[15px] leading-tight">{r.pack.name}</h3>
                  </div>
                  <StatusPill tone={r.econ.margin >= 45 ? 'ok' : r.econ.margin >= 25 ? 'warn' : 'bad'}>
                    {r.econ.margin.toFixed(0)}% margin
                  </StatusPill>
                </div>
                <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-wahj-smoke">{r.pack.story}</p>
                <ul className="mt-3 space-y-1 text-[11.5px]">
                  {r.pack.items.map((item) => {
                    const p = ctx.perfumesById.get(item.perfumeId)
                    return (
                      <li key={item.perfumeId} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {item.isFreeGift && <span className="mr-1 text-wahj-gold">★</span>}
                          {p?.name}
                        </span>
                        <span className="shrink-0 tnum text-wahj-smoke">
                          {item.isFreeGift ? 'free gift' : formatDH(p?.unitCost30ml ?? 0, { decimals: 2 })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 text-xs dark:border-white/[0.06]">
                  <span className="font-display text-lg tnum">{formatDH(r.pack.price)}</span>
                  <span className="text-right">
                    <span className="block text-pos tnum">{formatDH(Math.round(r.econ.profit))} profit/unit</span>
                    <span className="block text-[10px] text-wahj-smoke tnum">{formatNumber(r.units)} sold</span>
                  </span>
                </div>
              </article>
            ))}
          </div>

          <ChartCard
            title="Pack economics table"
            subtitle="The complete pack summary from your strategy doc — price, true cost, profit, margin"
            bodyClassName="!px-0 !pb-0"
          >
            <DataTable
              rows={packRows}
              columns={packColumns}
              rowKey={(r) => r.pack.id}
              initialSort={{ key: 'revenue', dir: 'desc' }}
              searchPlaceholder="Search packs…"
              searchText={(r) => `${r.pack.name} ${r.pack.gender} ${r.pack.slug}`}
              csvName="wahj-packs.csv"
              pageSize={8}
            />
          </ChartCard>
        </>
      )}

      <NoteCard
        title="Reading this screen"
        items={[
          'Unit cost = (oil + alcohol + bottles + labels) ÷ 16 bottles, snapshotted per batch — change the recipe, not the number.',
          'Pack margin already subtracts the 35 DH delivery you absorb and the 15% return provision.',
          filters.classes.length < 3 ? 'ABC filter is active: only the selected classes are counted here.' : 'Switch the ABC filter above to isolate heroes vs. long tail.',
        ]}
      />
    </div>
  )
}

function BatchDetail({ batches, perfume }: { batches: ProductionBatch[]; perfume: Perfume }) {
  const recent = [...batches].sort((a, b) => b.productionDate.localeCompare(a.productionDate)).slice(0, 6)
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wahj-smoke">
        Batch history · {perfume.name} · {batches.length} runs · {formatDH(perfume.unitCost30ml, { decimals: 2 })}/bottle
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {recent.map((b) => (
          <div key={b.id} className="rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2 text-[11px] dark:border-white/[0.07] dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <span className="font-medium tnum">{b.code}</span>
              <StatusPill tone={b.status === 'IN_STOCK' ? 'ok' : b.status === 'DEPLETED' ? 'neutral' : b.status === 'READY' ? 'warn' : 'info'}>
                {b.status.toLowerCase().replace('_', ' ')}
              </StatusPill>
            </div>
            <p className="mt-1.5 text-wahj-smoke tnum">
              produced {b.productionDate} · ready {b.readyDate}
            </p>
            <p className="text-wahj-smoke tnum">
              {b.bottlesRemaining}/{b.bottleCount} bottles left · {formatDH(Math.round(b.costPerBatch))} batch cost
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
