import { useState } from 'react'
import { useDashboard } from '../state/store'
import { FilterBar } from '../components/FilterBar'
import { KpiCard } from '../components/KpiCard'
import { ChartCard, SegmentedControl, StatusPill } from '../components/ChartCard'
import { DataTable, type Column } from '../components/DataTable'
import { MiniBarChart, OrderHeatmap, RankedBars } from '../charts/BreakdownCharts'
import { ProfitAreaChart, RevenueChart } from '../charts/RevenueCharts'
import { formatDH, formatDateTime, formatNumber } from '../lib/dates'
import { trend } from '../lib/metrics'
import type { Order } from '../lib/types'
import { IconBox, IconCoins, IconDroplet, IconTrendDown } from '../components/icons'

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  delivered: 'ok',
  shipped: 'info',
  confirmed: 'info',
  pending: 'warn',
  returned: 'bad',
  cancelled: 'neutral',
}

export function Sales() {
  const { orders, kpis, prevKpis, buckets, heatmap, theme, granularity, cityRows, channelRows } = useDashboard()
  const [metric, setMetric] = useState<'revenue' | 'profit' | 'orders' | 'bottles'>('revenue')
  const [dimension, setDimension] = useState<'cities' | 'channels'>('cities')

  const delta = (a: number, b: number) => trend(a, b)

  const basketSeries = buckets.map((b) => ({ label: b.label, value: b.aov }))
  const bottlesSeries = buckets.map((b) => ({ label: b.label, value: b.bottles }))

  const columns: Column<Order>[] = [
    { key: 'code', header: 'Order', sortValue: (o) => o.code, render: (o) => <span className="font-medium tnum">{o.code}</span> },
    {
      key: 'createdAt',
      header: 'Placed',
      sortValue: (o) => o.createdAt,
      csv: (o) => formatDateTime(o.createdAt),
      render: (o) => <span className="tnum text-wahj-smoke">{formatDateTime(o.createdAt)}</span>,
    },
    {
      key: 'channel',
      header: 'Channel / type',
      sortValue: (o) => `${o.channel}-${o.orderType}`,
      csv: (o) => `${o.channel} ${o.orderType}`,
      render: (o) => (
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${o.channel === 'LOCAL' ? 'bg-wahj-gold' : 'bg-wahj-ember'}`} />
          <span className="capitalize">{o.channel.toLowerCase()}</span>
          <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-wahj-smoke dark:bg-white/[0.07]">
            {o.orderType.replace('_', ' ').toLowerCase()}
          </span>
        </span>
      ),
    },
    { key: 'city', header: 'City', sortValue: (o) => o.city, render: (o) => <span className="text-wahj-smoke">{o.city}</span> },
    {
      key: 'bottles',
      header: 'Bottles',
      align: 'right',
      sortValue: (o) => o.items.reduce((s, it) => s + it.bottles, 0),
      render: (o) => <span className="tnum">{o.items.reduce((s, it) => s + it.bottles, 0)}</span>,
    },
    { key: 'revenue', header: 'Gross', align: 'right', sortValue: (o) => o.grossRevenue, render: (o) => <span className="tnum">{formatDH(o.grossRevenue)}</span> },
    {
      key: 'production',
      header: 'Production',
      align: 'right',
      sortValue: (o) => o.productionCost,
      render: (o) => <span className="tnum text-wahj-smoke">{formatDH(Math.round(o.productionCost))}</span>,
    },
    {
      key: 'delivery',
      header: 'Delivery',
      align: 'right',
      sortValue: (o) => o.deliveryFee,
      render: (o) => <span className="tnum text-wahj-smoke">{o.deliveryFee ? formatDH(o.deliveryFee) : '—'}</span>,
    },
    {
      key: 'provision',
      header: 'Return provision',
      align: 'right',
      sortValue: (o) => o.returnProvision,
      render: (o) => <span className="tnum text-wahj-smoke">{o.returnProvision ? formatDH(Math.round(o.returnProvision)) : '—'}</span>,
    },
    {
      key: 'netProfit',
      header: 'Net profit',
      align: 'right',
      sortValue: (o) => o.netProfit,
      render: (o) => <span className={`tnum font-medium ${o.netProfit >= 0 ? 'text-pos' : 'text-neg'}`}>{formatDH(Math.round(o.netProfit))}</span>,
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortValue: (o) => (o.grossRevenue ? (o.netProfit / o.grossRevenue) * 100 : 0),
      render: (o) => (
        <span className="tnum">
          {o.grossRevenue ? `${((o.netProfit / o.grossRevenue) * 100).toFixed(0)}%` : '—'}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (o) => o.status, render: (o) => <StatusPill tone={STATUS_TONE[o.status] ?? 'neutral'}>{o.status}</StatusPill> },
  ]

  const rankRows = dimension === 'cities' ? cityRows : channelRows

  return (
    <div className="space-y-4">
      <FilterBar />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Basket size"
          value={kpis.aov}
          format={(n) => formatDH(Math.round(n))}
          delta={delta(kpis.aov, prevKpis.aov)}
          accent="gold"
          icon={<IconCoins className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => b.aov)}
          hint={<span className="tnum">Across both channels</span>}
        />
        <KpiCard
          label="Bottles / order"
          value={kpis.avgBasketBottles}
          format={(n) => n.toFixed(1)}
          delta={delta(kpis.avgBasketBottles, prevKpis.avgBasketBottles)}
          accent="violet"
          icon={<IconDroplet className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => (b.orders ? b.bottles / b.orders : 0))}
          hint={<span className="tnum">{formatNumber(kpis.bottles)} bottles total</span>}
        />
        <KpiCard
          label="Return rate"
          value={kpis.onlineReturnRate}
          format={(n) => `${n.toFixed(1)}%`}
          delta={delta(kpis.onlineReturnRate, prevKpis.onlineReturnRate)}
          invertDelta
          accent="ember"
          icon={<IconTrendDown className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => (b.orders ? (b.returns / b.orders) * 100 : 0))}
          hint={<span className="tnum">Online only · local sits at {kpis.localReturnRate.toFixed(1)}%</span>}
        />
        <KpiCard
          label="Orders"
          value={kpis.orders}
          format={(n) => formatNumber(Math.round(n))}
          delta={delta(kpis.orders, prevKpis.orders)}
          accent="sage"
          icon={<IconBox className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => b.orders)}
          hint={
            <span className="tnum">
              {channelRows[0]?.orders ?? 0} local · {channelRows[1]?.orders ?? 0} online
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Order stream"
          subtitle="Same data as the revenue chart but read as volume — spot the Friday/Saturday rush"
          footer={<span>Weekend uplifts are the strongest signal in the whole dataset; schedule production Monday, promos Thursday.</span>}
        >
          <RevenueChart buckets={buckets} mode={theme} granularity={granularity} showProfit />
        </ChartCard>

        <ChartCard title="Buying rhythm" subtitle="Weekday × hour — when orders actually arrive">
          <OrderHeatmap grid={heatmap} mode={theme} />
          <div className="mt-4 space-y-2 rounded-xl border border-black/[0.05] p-3 text-[11px] text-wahj-smoke dark:border-white/[0.05]">
            <p>
              Peak window:{' '}
              <strong className="text-wahj-ink dark:text-wahj-sand">
                {(() => {
                  let best = { d: 0, h: 0, v: 0 }
                  heatmap.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { d, h, v })))
                  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                  return `${days[best.d]} ${String(best.h).padStart(2, '0')}:00`
                })()}
              </strong>
            </p>
            <p>WhatsApp replies inside that window get the fastest COD confirmation.</p>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Profit by channel over time"
          subtitle="Local vs online contribution inside the range"
        >
          <ProfitAreaChart buckets={buckets} mode={theme} granularity={granularity} />
        </ChartCard>

        <ChartCard
          title="Breakdown"
          subtitle="Pick a metric, then a dimension"
          actions={
            <SegmentedControl
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'revenue', label: 'Rev' },
                { value: 'profit', label: 'Profit' },
                { value: 'orders', label: 'Orders' },
                { value: 'bottles', label: 'Bottles' },
              ]}
            />
          }
        >
          <div className="mb-3">
            <SegmentedControl
              size="sm"
              value={dimension}
              onChange={setDimension}
              options={[
                { value: 'cities', label: 'By city' },
                { value: 'channels', label: 'By channel' },
              ]}
            />
          </div>
          <RankedBars
            rows={rankRows}
            mode={theme}
            metric={metric}
            limit={dimension === 'cities' ? 8 : 2}
            colorMode={dimension === 'channels' ? 'channel' : 'gradient'}
            money={metric === 'revenue' || metric === 'profit'}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Average basket over time" subtitle={`Basket size per ${granularity}`}>
          <MiniBarChart data={basketSeries} mode={theme} color={theme === 'dark' ? '#D9C9A3' : '#6B6157'} />
        </ChartCard>
        <ChartCard title="Bottles sold over time" subtitle={`Volume per ${granularity} — the production signal`}>
          <MiniBarChart data={bottlesSeries} mode={theme} color={theme === 'dark' ? '#B8560E' : '#C2580F'} />
        </ChartCard>
      </div>

      <ChartCard
        title="Order ledger"
        subtitle="Cost columns mirror the two-channel rules: local pays no delivery and no return provision"
        bodyClassName="!px-0 !pb-0"
      >
        <DataTable
          rows={orders}
          columns={columns}
          rowKey={(o) => o.id}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          searchPlaceholder="Search code, city, status…"
          searchText={(o) => `${o.code} ${o.city} ${o.status} ${o.channel} ${o.orderType}`}
          csvName="wahj-sales-ledger.csv"
          pageSize={15}
        />
      </ChartCard>
    </div>
  )
}
