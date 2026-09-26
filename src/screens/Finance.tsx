import { useMemo, useState } from 'react'
import { useDashboard } from '../state/store'
import { FilterBar } from '../components/FilterBar'
import { KpiCard } from '../components/KpiCard'
import { ChartCard, SegmentedControl } from '../components/ChartCard'
import { DataTable, type Column } from '../components/DataTable'
import { NoteCard } from '../components/NoteCard'
import { RevenueChart } from '../charts/RevenueCharts'
import { RankedBars } from '../charts/BreakdownCharts'
import { monthlyPnL, trend, type PLBucket } from '../lib/metrics'
import { formatDH, monthLabel } from '../lib/dates'
import { IconAlert, IconCoins, IconFlame, IconLayers } from '../components/icons'

const pct = (n: number) => `${(n * 100).toFixed(0)}%`

export function Finance() {
  const { pnl, orders, theme, granularity, buckets, kpis, settings } = useDashboard()
  const [ledger, setLedger] = useState<'monthly' | 'channels'>('monthly')

  const months = useMemo(() => monthlyPnL(orders).slice(-12), [orders])

  const rowColumns: Column<{ id: string; label: string; local: PLBucket; online: PLBucket; combined: PLBucket }>[] = [
    { key: 'label', header: 'Period', sortValue: (r) => r.id, render: (r) => <span className="font-medium">{r.label}</span> },
    {
      key: 'localRev',
      header: 'Local revenue',
      align: 'right',
      sortValue: (r) => r.local.revenue,
      render: (r) => (
        <span className="tnum">
          {formatDH(Math.round(r.local.revenue))}
          <span className="ml-1 text-[10px] text-wahj-smoke">{r.local.margin.toFixed(0)}%</span>
        </span>
      ),
    },
    {
      key: 'onlineRev',
      header: 'Online revenue',
      align: 'right',
      sortValue: (r) => r.online.revenue,
      render: (r) => (
        <span className="tnum">
          {formatDH(Math.round(r.online.revenue))}
          <span className="ml-1 text-[10px] text-wahj-smoke">{r.online.margin.toFixed(0)}%</span>
        </span>
      ),
    },
    {
      key: 'production',
      header: 'Production',
      align: 'right',
      sortValue: (r) => r.combined.production,
      render: (r) => <span className="tnum text-wahj-smoke">−{formatDH(Math.round(r.combined.production))}</span>,
    },
    {
      key: 'delivery',
      header: 'Delivery',
      align: 'right',
      sortValue: (r) => r.combined.delivery,
      render: (r) => <span className="tnum text-wahj-smoke">−{formatDH(Math.round(r.combined.delivery))}</span>,
    },
    {
      key: 'returns',
      header: 'Returns',
      align: 'right',
      sortValue: (r) => r.combined.returns,
      render: (r) => <span className="tnum text-wahj-smoke">−{formatDH(Math.round(r.combined.returns))}</span>,
    },
    {
      key: 'profit',
      header: 'Net profit',
      align: 'right',
      sortValue: (r) => r.combined.profit,
      render: (r) => <span className={`tnum font-medium ${r.combined.profit >= 0 ? 'text-pos' : 'text-neg'}`}>{formatDH(Math.round(r.combined.profit))}</span>,
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortValue: (r) => r.combined.margin,
      render: (r) => <span className="tnum">{r.combined.margin.toFixed(1)}%</span>,
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      sortValue: (r) => r.combined.orders,
      render: (r) => (
        <span className="tnum text-wahj-smoke">
          {r.combined.orders} <span className="text-[10px]">({r.local.orders}L / {r.online.orders}O)</span>
        </span>
      ),
    },
  ]

  const monthRows = months.map((m) => ({ id: m.month, label: monthLabel(m.month), local: m.local, online: m.online, combined: m.combined }))

  const channelRows = [
    { id: 'local', label: 'Local channel', local: pnl.local, online: pnl.local, combined: pnl.local },
    { id: 'online', label: 'Online channel', local: pnl.online, online: pnl.online, combined: pnl.online },
    { id: 'combined', label: 'Combined', local: pnl.local, online: pnl.online, combined: pnl.combined },
  ]

  const prevProfit = months.length > 1 ? months[months.length - 2].combined.profit : 0
  const profitDelta = trend(pnl.combined.profit, prevProfit)

  return (
    <div className="space-y-4">
      <FilterBar />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Net profit"
          value={pnl.combined.profit}
          format={(n) => formatDH(Math.round(n))}
          delta={profitDelta}
          accent="sage"
          icon={<IconCoins className="h-3.5 w-3.5" />}
          spark={buckets.map((b) => b.profit)}
          hint={<span className="tnum">Margin {pnl.combined.margin.toFixed(1)}% of {formatDH(Math.round(pnl.combined.revenue))}</span>}
        />
        <KpiCard
          label="Delivery absorbed"
          value={pnl.online.delivery}
          format={(n) => formatDH(Math.round(n))}
          accent="ember"
          icon={<IconLayers className="h-3.5 w-3.5" />}
          hint={<span className="tnum">{pnl.online.orders} online orders × {formatDH(settings.deliveryFee)}</span>}
        />
        <KpiCard
          label="Return provision"
          value={pnl.expectedReturnLoss}
          format={(n) => formatDH(Math.round(n))}
          accent="violet"
          icon={<IconFlame className="h-3.5 w-3.5" />}
          hint={<span className="tnum">Real damage so far: {formatDH(Math.round(pnl.actualReturnLoss))}</span>}
        />
        <KpiCard
          label="Local margin"
          value={pnl.local.margin}
          format={(n) => `${n.toFixed(1)}%`}
          accent="gold"
          icon={<IconCoins className="h-3.5 w-3.5" />}
          hint={<span className="tnum">Online margin {pnl.online.margin.toFixed(1)}% after all provisions</span>}
        />
      </div>

      {/* ── The P&L table from the strategy doc ── */}
      <ChartCard
        title="Monthly P&L — two channels"
        subtitle="Exactly the structure of your paper tracker: revenue, production, delivery, returns, net profit per channel"
        actions={
          <SegmentedControl
            size="sm"
            value={ledger}
            onChange={setLedger}
            options={[
              { value: 'monthly', label: 'Last 12 months' },
              { value: 'channels', label: 'Selected range' },
            ]}
          />
        }
        bodyClassName="!px-0 !pb-0"
        footer={
          <span>
            Delivery and return provisions are only applied to ONLINE rows — that is the whole reason local margin ({(pnl.local.margin).toFixed(0)}%)
            sits far above online ({(pnl.online.margin).toFixed(0)}%).
          </span>
        }
      >
        <DataTable
          rows={ledger === 'monthly' ? monthRows : channelRows}
          columns={rowColumns}
          rowKey={(r) => r.id}
          initialSort={ledger === 'monthly' ? { key: 'label', dir: 'desc' } : undefined}
          searchable={false}
          csvName={`wahj-pnl-${ledger}.csv`}
          pageSize={ledger === 'monthly' ? 12 : 3}
          pageSizeOptions={[12, 24]}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Revenue vs cost vs profit"
          subtitle="Stacked channel revenue with the profit line — watch the gap widen in Ramadan and December"
          footer={<span>Hover any bucket for the full cost decomposition, orders and bottles behind it.</span>}
        >
          <RevenueChart buckets={buckets} mode={theme} granularity={granularity} />
        </ChartCard>

        <ChartCard
          title="40 / 30 / 20 / 10 allocation"
          subtitle={`Split of ${formatDH(Math.round(pnl.combined.profit))} net profit — a suggestion, not a transaction`}
          footer={<span>Change the split on the Business Rules screen; these amounts update instantly.</span>}
        >
          <div className="space-y-3">
            {pnl.allocation.map((a) => (
              <div key={a.label}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium">
                    {a.label} <span className="text-wahj-smoke tnum">{pct(a.rate)}</span>
                  </span>
                  <span className="font-display text-base tnum">{formatDH(Math.round(a.amount))}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-wahj-ember via-wahj-gold to-wahj-bright transition-[width] duration-700 ease-smooth"
                    style={{ width: `${a.rate * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10.5px] text-wahj-smoke">{a.hint}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Profit contribution" subtitle="Which channel actually funds the business">
          <RankedBars
            rows={[
              { name: 'Local profit', revenue: pnl.local.profit, profit: pnl.local.profit, orders: pnl.local.orders, bottles: pnl.local.bottles },
              { name: 'Online profit', revenue: pnl.online.profit, profit: pnl.online.profit, orders: pnl.online.orders, bottles: pnl.online.bottles },
            ]}
            mode={theme}
            metric="profit"
            colorMode="channel"
            limit={2}
          />
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
            <div className="rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.07]">
              <p className="text-wahj-smoke">Local bottles / order</p>
              <p className="mt-0.5 font-display text-lg tnum">
                {pnl.local.orders ? (pnl.local.bottles / pnl.local.orders).toFixed(1) : '0'}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.07]">
              <p className="text-wahj-smoke">Online bottles / order</p>
              <p className="mt-0.5 font-display text-lg tnum">
                {pnl.online.orders ? (pnl.online.bottles / pnl.online.orders).toFixed(1) : '0'}
              </p>
              <p className="text-[10px] text-wahj-smoke">packs carry 3–5 bottles each</p>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Returns reality check" subtitle="Provisioned vs. actually lost">
          <div className="space-y-3 text-[12px]">
            <div className="flex items-center justify-between rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.07]">
              <span>
                <span className="block font-medium">Expected (15% provision)</span>
                <span className="text-[10.5px] text-wahj-smoke">Reserved on every online order</span>
              </span>
              <span className="font-display text-lg tnum">{formatDH(Math.round(pnl.expectedReturnLoss))}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.07]">
              <span>
                <span className="block font-medium">Actual damage</span>
                <span className="text-[10.5px] text-wahj-smoke">Production + delivery + return shipping on returned orders</span>
              </span>
              <span className="font-display text-lg tnum text-neg">{formatDH(Math.round(pnl.actualReturnLoss))}</span>
            </div>
            <div
              className={`flex items-center gap-2 rounded-xl border p-3 ${
                pnl.expectedReturnLoss >= pnl.actualReturnLoss ? 'border-pos/25 bg-pos/[0.07] text-pos' : 'border-warn/25 bg-warn/[0.07] text-warn'
              }`}
            >
              <IconAlert className="h-4 w-4 shrink-0" />
              <span className="text-[11.5px] leading-relaxed">
                {pnl.expectedReturnLoss >= pnl.actualReturnLoss
                  ? `You are ahead by ${formatDH(Math.round(pnl.expectedReturnLoss - pnl.actualReturnLoss))} — the provision is doing its job. Keep pricing packs with this buffer.`
                  : `Returns cost ${formatDH(Math.round(pnl.actualReturnLoss - pnl.expectedReturnLoss))} more than reserved. Tighten the pack descriptions or the courier, or shift the provision up.`}
              </span>
            </div>
            <p className="text-[11px] text-wahj-smoke tnum">
              Selected range: {pnl.combined.orders} orders · {formatDH(Math.round(kpis.revenue))} revenue · {formatDH(Math.round(kpis.profit))} profit.
            </p>
          </div>
        </ChartCard>
      </div>

      <NoteCard
        title="How the two-channel P&L is calculated"
        items={[
          'LOCAL: revenue = gross (no delivery, no provision). Cost = production only. Returns are rare and cost nothing extra beyond the lost sale.',
          'ONLINE: cost = production + 35 DH delivery absorbed + 15% of order value + 25 DH return shipping when an order actually comes back.',
          'Cancelled orders are excluded from every number; returned orders count as zero revenue but keep their cost, which is exactly how the damage appears.',
          'The 40/30/20/10 split is applied to net profit, never to revenue — it is a plan for money you have already earned.',
        ]}
      />
    </div>
  )
}
