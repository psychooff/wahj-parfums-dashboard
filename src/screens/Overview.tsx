import { useDashboard } from '../state/store'
import { KpiCard } from '../components/KpiCard'
import { ChartCard, SegmentedControl, StatusPill } from '../components/ChartCard'
import { FilterBar } from '../components/FilterBar'
import { DataTable, type Column } from '../components/DataTable'
import { InsightList } from '../components/Insights'
import { DonutChart, RankedBars } from '../charts/BreakdownCharts'
import { CumulativeChart, ProfitAreaChart, RevenueChart } from '../charts/RevenueCharts'
import { formatDH, formatDateTime, formatNumber } from '../lib/dates'
import { trend } from '../lib/metrics'
import type { Order } from '../lib/types'
import { IconBox, IconCoins, IconDroplet, IconFlame, IconDownload } from '../components/icons'
import { useNavigate } from '../components/Shell'
import { useMedia } from '../state/media'
import { Thumb } from '../components/Thumb'
import { useState } from 'react'

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  delivered: 'ok',
  shipped: 'info',
  confirmed: 'info',
  pending: 'warn',
  returned: 'bad',
  cancelled: 'neutral',
}

export function Overview() {
  const { kpis, prevKpis, buckets, channelRows, classRows, cityRows, perfumes, orders, theme, dataset, granularity, dataSource } = useDashboard()
  const navigate = useNavigate()
  const media = useMedia()
  const [donutMetric, setDonutMetric] = useState<'revenue' | 'orders'>('revenue')
  const photosMissing = dataset.perfumes.filter((p) => !media.images[p.id]).length

  const revDelta = trend(kpis.revenue, prevKpis.revenue)
  const profitDelta = trend(kpis.profit, prevKpis.profit)
  const ordersDelta = trend(kpis.orders, prevKpis.orders)
  const bottlesDelta = trend(kpis.bottles, prevKpis.bottles)

  const columns: Column<Order>[] = [
    {
      key: 'code',
      header: 'Order',
      sortValue: (o) => o.code,
      csv: (o) => o.code,
      render: (o) => <span className="font-medium tnum">{o.code}</span>,
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortValue: (o) => o.createdAt,
      csv: (o) => formatDateTime(o.createdAt),
      render: (o) => <span className="text-wahj-smoke tnum">{formatDateTime(o.createdAt)}</span>,
    },
    {
      key: 'channel',
      header: 'Channel',
      sortValue: (o) => o.channel,
      csv: (o) => o.channel,
      render: (o) => (
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${o.channel === 'LOCAL' ? 'bg-wahj-gold' : 'bg-wahj-ember'}`} />
          <span className="capitalize">{o.channel.toLowerCase()}</span>
          <span className="text-[10px] text-wahj-smoke">{o.orderType.replace('_', ' ').toLowerCase()}</span>
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      sortValue: (o) => o.items.reduce((s, it) => s + it.quantity, 0),
      csv: (o) => o.items.map((it) => `${it.quantity}× ${it.name}`).join(' | '),
      render: (o) => (
        <span className="block max-w-[260px] truncate text-wahj-smoke" title={o.items.map((it) => `${it.quantity}× ${it.name}`).join('\n')}>
          {o.items.map((it) => `${it.quantity}× ${it.name}`).join(', ')}
        </span>
      ),
    },
    { key: 'city', header: 'City', sortValue: (o) => o.city, csv: (o) => o.city, render: (o) => <span className="text-wahj-smoke">{o.city}</span> },
    {
      key: 'bottles',
      header: 'Bottles',
      align: 'right',
      sortValue: (o) => o.items.reduce((s, it) => s + it.bottles, 0),
      csv: (o) => o.items.reduce((s, it) => s + it.bottles, 0),
      render: (o) => <span className="tnum">{o.items.reduce((s, it) => s + it.bottles, 0)}</span>,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortValue: (o) => o.grossRevenue,
      csv: (o) => o.grossRevenue,
      render: (o) => <span className="tnum font-medium">{formatDH(o.grossRevenue)}</span>,
    },
    {
      key: 'profit',
      header: 'Net profit',
      align: 'right',
      sortValue: (o) => o.netProfit,
      csv: (o) => o.netProfit,
      render: (o) => (
        <span className={`tnum font-medium ${o.netProfit >= 0 ? 'text-pos' : 'text-neg'}`}>{formatDH(Math.round(o.netProfit))}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (o) => o.status,
      csv: (o) => o.status,
      render: (o) => (
        <StatusPill tone={STATUS_TONE[o.status] ?? 'neutral'} pulse={o.status === 'pending'}>
          {o.status}
        </StatusPill>
      ),
    },
  ]

  const topPerfumeRows = perfumes.slice(0, 8).map((p) => ({
    name: `${p.perfume.name} · ${p.perfume.brand}`,
    revenue: Math.round(p.revenue),
    profit: Math.round(p.profit),
    orders: p.orders,
    bottles: p.bottles,
  }))

  return (
    <div className="space-y-4">
      {/* ── Where to put your own data ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <button
          onClick={() => navigate('data')}
          className="card group flex items-center gap-3 p-4 text-left transition-transform duration-300 ease-smooth hover:-translate-y-0.5 lg:col-span-2"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-wahj-gold/30 bg-gradient-to-b from-wahj-bright/20 to-wahj-ember/20 text-wahj-gold shadow-ember">
            <IconDownload className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[15px]">{dataSource === 'imported' ? 'Your data manager' : 'Put your real data in here'}</span>
              <StatusPill tone={dataSource === 'imported' ? 'ok' : 'info'}>
                {dataSource === 'imported' ? 'reading your files' : 'currently on sample data'}
              </StatusPill>
            </span>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-wahj-smoke">
              Drop a CSV of your orders, production log or catalogue — or upload a photo for each product. You can also commit files to{' '}
              <code className="rounded bg-black/[0.06] px-1 dark:bg-white/[0.08]">public/data/</code> and{' '}
              <code className="rounded bg-black/[0.06] px-1 dark:bg-white/[0.08]">public/products/</code> and they load automatically.
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 text-[11px] font-medium text-wahj-gold opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
            Open Data &amp; Photos →
          </span>
        </button>

        <div className="card flex items-center gap-3 p-4">
          <span className="flex shrink-0 items-center gap-1">
            {dataset.perfumes.slice(0, 3).map((p) => (
              <Thumb key={p.id} perfume={p} size={34} />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium">
              {photosMissing === 0 ? 'Every SKU has a photo' : `${photosMissing} SKUs still without a photo`}
            </span>
            <span className="mt-0.5 block text-[11px] text-wahj-smoke">
              {Object.keys(media.images).length} of {dataset.perfumes.length} loaded · gold monograms fill the gaps
            </span>
            <button onClick={() => navigate('data')} className="mt-2 text-[11px] font-medium text-wahj-gold hover:underline">
              Add product pictures →
            </button>
          </span>
        </div>
      </div>

      <FilterBar />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={kpis.revenue}
          format={(n) => formatDH(Math.round(n))}
          delta={revDelta}
          accent="gold"
          icon={<IconCoins className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => b.revenue)}
          hint={
            <span className="tnum">
              Local {formatDH(Math.round(kpis.localRevenue), { compact: true })} · Online{' '}
              {formatDH(Math.round(kpis.onlineRevenue), { compact: true })}
            </span>
          }
        />
        <KpiCard
          label="Net profit"
          value={kpis.profit}
          format={(n) => formatDH(Math.round(n))}
          delta={profitDelta}
          accent="sage"
          icon={<IconFlame className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => b.profit)}
          hint={<span className="tnum">Margin {kpis.margin.toFixed(1)}% after delivery &amp; return provision</span>}
        />
        <KpiCard
          label="Orders"
          value={kpis.orders}
          format={(n) => formatNumber(Math.round(n))}
          delta={ordersDelta}
          accent="ember"
          icon={<IconBox className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => b.orders)}
          hint={
            <span className="tnum">
              Basket {formatDH(Math.round(kpis.aov))} · {kpis.avgBasketBottles} bottles
            </span>
          }
        />
        <KpiCard
          label="Bottles sold"
          value={kpis.bottles}
          format={(n) => formatNumber(Math.round(n))}
          delta={bottlesDelta}
          accent="violet"
          icon={<IconDroplet className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => b.bottles)}
          hint={
            <span className="tnum">
              {kpis.customers} buyers · {kpis.repeatRate.toFixed(0)}% repeat
            </span>
          }
        />
      </div>

      {/* ── Revenue + channel mix ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Revenue by channel"
          subtitle="Stacked daily/weekly revenue with the net-profit line on top — bars follow the selected range"
          footer={
            <span className="tnum">
              {buckets.length} buckets · {granularity} resolution · hover any bar for orders, bottles, costs and profit
            </span>
          }
        >
          <RevenueChart buckets={buckets} mode={theme} granularity={granularity} />
        </ChartCard>

        <ChartCard
          title="Channel mix"
          subtitle="Where the money and the orders come from"
          actions={
            <SegmentedControl
              size="sm"
              value={donutMetric}
              onChange={setDonutMetric}
              options={[
                { value: 'revenue', label: 'DH' },
                { value: 'orders', label: 'Orders' },
              ]}
            />
          }
          footer={
            <span>
              Online is pack-only by rule; local is singles &amp; 2-packs with no delivery cost.
            </span>
          }
        >
          <DonutChart
            rows={channelRows}
            mode={theme}
            metric={donutMetric}
            centerLabel={donutMetric === 'revenue' ? 'Revenue' : 'Orders'}
            centerValue={
              donutMetric === 'revenue'
                ? formatDH(Math.round(kpis.revenue), { compact: true })
                : formatNumber(kpis.orders)
            }
          />
        </ChartCard>
      </div>

      {/* ── Insights + profit trend ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Profit trend"
          subtitle="Daily profit generated by each channel inside the selected range"
          footer={<span>Delivery and return provisions are already subtracted — this is money you keep.</span>}
        >
          <ProfitAreaChart buckets={buckets} mode={theme} granularity={granularity} />
        </ChartCard>
        <ChartCard title="What needs your attention" subtitle="Auto-generated from the current view">
          <InsightList limit={5} />
        </ChartCard>
      </div>

      {/* ── Breakdowns ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Top SKUs" subtitle="Revenue ranked · packs attributed to their components">
          <RankedBars rows={topPerfumeRows} mode={theme} metric="revenue" limit={8} />
        </ChartCard>
        <ChartCard title="Cities" subtitle="Where COD orders land (delivery cost is region-blind at 35 DH)">
          <RankedBars rows={cityRows} mode={theme} metric="revenue" limit={8} colorMode="gradient" />
        </ChartCard>
        <ChartCard
          className="lg:col-span-2 xl:col-span-1"
          title="ABC performance"
          subtitle="Revenue and profit by class"
          footer={<span>A-class triggers reorder at 8 bottles, B at 5, C at 3 — see Stock &amp; Maceration.</span>}
        >
          <DonutChart
            rows={classRows}
            mode={theme}
            metric="revenue"
            centerLabel="Revenue"
            centerValue={formatDH(Math.round(kpis.revenue), { compact: true })}
            colors={undefined}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Cumulative revenue" subtitle="Inside the selected window">
          <CumulativeChart buckets={buckets} mode={theme} />
        </ChartCard>
        <ChartCard title="Live order feed" subtitle="Newest first — sort, search and export below">
          <ul className="max-h-[190px] space-y-2 overflow-y-auto pr-1">
            {orders.slice(0, 12).map((o: Order, i: number) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.05] px-2.5 py-2 text-xs animate-fade-up dark:border-white/[0.05]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="min-w-0">
                  <span className="block font-medium tnum">{o.code}</span>
                  <span className="block truncate text-[10.5px] text-wahj-smoke">
                    {o.city} · {o.items.length} line{o.items.length > 1 ? 's' : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold tnum">{formatDH(o.grossRevenue)}</span>
                  <span
                    className={`block text-[10px] ${o.channel === 'LOCAL' ? 'text-wahj-gold' : 'text-wahj-ember'}`}
                  >
                    {o.channel.toLowerCase()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      {/* ── Full order table ── */}
      <ChartCard
        title="Orders"
        subtitle="Every order in the selected range — click a column header to sort, search anything, export to CSV"
        bodyClassName="!px-0 !pb-0"
      >
        <DataTable
          rows={orders}
          columns={columns}
          rowKey={(o) => o.id}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          searchPlaceholder="Search order code, item, city…"
          searchText={(o) => `${o.code} ${o.city} ${o.channel} ${o.status} ${o.items.map((it) => it.name).join(' ')}`}
          csvName={`wahj-orders-${dataset.historyEnd}.csv`}
          pageSize={10}
        />
      </ChartCard>

      <p className="px-1 text-[11px] leading-relaxed text-wahj-smoke">
        Sample data generated from your v1 rulebook — 1 batch = 500ml = 16 × 30ml, 14-day maceration, {formatDH(35)} delivery absorbed on
        online orders, 15% return provision, 40/30/20/10 allocation. {dataset.orders.length.toLocaleString('en-US')} orders and{' '}
        {dataset.batches.length.toLocaleString('en-US')} production batches between {dataset.historyStart} and {dataset.historyEnd}.
      </p>
    </div>
  )
}
