import { useMemo, useState } from 'react'
import { useDashboard } from '../state/store'
import { FilterBar } from '../components/FilterBar'
import { KpiCard } from '../components/KpiCard'
import { ChartCard, SegmentedControl, StatusPill } from '../components/ChartCard'
import { DataTable, type Column } from '../components/DataTable'
import { NoteCard } from '../components/NoteCard'
import { RankedBars } from '../charts/BreakdownCharts'
import { OrderHeatmap } from '../charts/BreakdownCharts'
import { formatDH, daysBetween, parseDay, startOfDay } from '../lib/dates'
import type { Customer } from '../lib/types'
import { IconDroplet, IconSpark, IconUsers } from '../components/icons'

function loyaltyTone(c: Customer): { tone: 'ok' | 'warn' | 'info' | 'neutral'; label: string } {
  if (c.bottlesThisCycle >= 5) return { tone: 'ok', label: '6th bottle free — redeem now' }
  if (c.bottlesThisCycle >= 4) return { tone: 'warn', label: '1 bottle from a free one' }
  if (c.bottlesThisCycle >= 2) return { tone: 'info', label: `${5 - c.bottlesThisCycle} bottles to go` }
  return { tone: 'neutral', label: 'Cycle just started' }
}

export function Customers() {
  const { orders, dataset, theme, heatmap, kpis } = useDashboard()
  const [segment, setSegment] = useState<'all' | 'loyal' | 'atrisk' | 'local' | 'online'>('all')

  // Only customers who ordered inside the selected window appear in the table.
  const active = useMemo(() => {
    const seen = new Map<string, { orders: number; spent: number; bottles: number; last: string }>()
    for (const o of orders) {
      if (o.status === 'cancelled') continue
      const row = seen.get(o.customerId) ?? { orders: 0, spent: 0, bottles: 0, last: o.createdAt }
      row.orders += 1
      row.spent += o.revenue
      row.bottles += o.items.reduce((s, it) => s + it.bottles, 0)
      if (o.createdAt > row.last) row.last = o.createdAt
      seen.set(o.customerId, row)
    }
    const byId = new Map(dataset.customers.map((c) => [c.id, c]))
    return [...seen.entries()]
      .map(([id, row]) => {
        const base = byId.get(id)
        const customer: Customer = base
          ? { ...base, totalSpent: Math.round(row.spent * 100) / 100 }
          : {
              id,
              name: id.replace('C-', '').replace(/-/g, ' '),
              phone: '—',
              city: '—',
              channelAcquired: 'LOCAL',
              totalOrders: row.orders,
              totalSpent: row.spent,
              bottlesThisCycle: row.bottles % 5,
              loyaltyRewards: Math.floor(row.bottles / 5),
              lastOrderAt: row.last.slice(0, 10),
            }
        return { customer, window: row }
      })
      .sort((a, b) => b.window.spent - a.window.spent)
  }, [orders, dataset.customers])

  const filtered = useMemo(() => {
    const today = startOfDay(new Date())
    switch (segment) {
      case 'loyal':
        return active.filter((r) => r.customer.totalOrders >= 3)
      case 'atrisk':
        return active.filter((r) => daysBetween(parseDay(r.customer.lastOrderAt), today) >= 60)
      case 'local':
        return active.filter((r) => r.customer.channelAcquired === 'LOCAL')
      case 'online':
        return active.filter((r) => r.customer.channelAcquired === 'ONLINE')
      default:
        return active
    }
  }, [active, segment])

  const nearReward = active.filter((r) => r.customer.bottlesThisCycle >= 4)

  const columns: Column<(typeof active)[number]>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortValue: (r) => r.customer.name,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.customer.name}</span>
          <span className="text-[10.5px] text-wahj-smoke tnum">{r.customer.phone}</span>
        </span>
      ),
    },
    { key: 'city', header: 'City', sortValue: (r) => r.customer.city, render: (r) => <span className="text-wahj-smoke">{r.customer.city}</span> },
    {
      key: 'channel',
      header: 'Channel',
      sortValue: (r) => r.customer.channelAcquired,
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${r.customer.channelAcquired === 'LOCAL' ? 'bg-wahj-gold' : 'bg-wahj-ember'}`} />
          <span className="capitalize">{r.customer.channelAcquired.toLowerCase()}</span>
        </span>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      sortValue: (r) => r.customer.totalOrders,
      render: (r) => (
        <span className="tnum">
          {r.customer.totalOrders}
          <span className="ml-1 text-[10px] text-wahj-smoke">({r.window.orders} in range)</span>
        </span>
      ),
    },
    {
      key: 'bottles',
      header: 'Bottles',
      align: 'right',
      sortValue: (r) => r.window.bottles,
      render: (r) => <span className="tnum">{r.window.bottles}</span>,
    },
    {
      key: 'spent',
      header: 'Spent',
      align: 'right',
      sortValue: (r) => r.window.spent,
      render: (r) => <span className="tnum font-medium">{formatDH(Math.round(r.window.spent))}</span>,
    },
    {
      key: 'aov',
      header: 'Avg order',
      align: 'right',
      sortValue: (r) => r.window.spent / Math.max(1, r.window.orders),
      render: (r) => <span className="tnum">{formatDH(Math.round(r.window.spent / Math.max(1, r.window.orders)))}</span>,
    },
    {
      key: 'loyalty',
      header: 'Loyalty cycle',
      sortValue: (r) => r.customer.bottlesThisCycle,
      render: (r) => {
        const l = loyaltyTone(r.customer)
        return (
          <span className="flex items-center gap-2">
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i < r.customer.bottlesThisCycle ? 'bg-wahj-gold' : 'bg-black/[0.12] dark:bg-white/[0.14]'}`}
                />
              ))}
            </span>
            <StatusPill tone={l.tone}>{l.label}</StatusPill>
          </span>
        )
      },
    },
    {
      key: 'last',
      header: 'Last order',
      align: 'right',
      sortValue: (r) => r.customer.lastOrderAt,
      render: (r) => <span className="tnum text-wahj-smoke">{r.customer.lastOrderAt}</span>,
    },
  ]

  const topCities = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of active) map.set(r.customer.city, (map.get(r.customer.city) ?? 0) + 1)
    return [...map.entries()]
      .map(([name, v]) => ({ name, revenue: v, profit: v, orders: v, bottles: 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
  }, [active])

  return (
    <div className="space-y-4">
      <FilterBar />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active buyers"
          value={active.length}
          format={(n) => Math.round(n).toLocaleString('en-US')}
          accent="gold"
          icon={<IconUsers className="h-3.5 w-3.5" />}
          hint={<span className="tnum">{kpis.newCustomers} ordered for the first time in this window</span>}
        />
        <KpiCard
          label="Repeat rate"
          value={kpis.repeatRate}
          format={(n) => `${n.toFixed(1)}%`}
          accent="sage"
          icon={<IconSpark className="h-3.5 w-3.5" />}
          hint={<span className="tnum">Customers with 2+ orders inside the range</span>}
        />
        <KpiCard
          label="Revenue per customer"
          value={active.length ? kpis.revenue / active.length : 0}
          format={(n) => formatDH(Math.round(n))}
          accent="ember"
          icon={<IconDroplet className="h-3.5 w-3.5" />}
          hint={<span className="tnum">Across the selected segment</span>}
        />
        <KpiCard
          label="Loyalty rewards ready"
          value={nearReward.length}
          format={(n) => `${Math.round(n)} customers`}
          accent="violet"
          icon={<IconSpark className="h-3.5 w-3.5" />}
          hint={<span className="tnum">4+ bottles in their current 5-bottle cycle</span>}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Top customers in range"
          subtitle="Ranked by spend — the cheapest revenue in the business is a message to these people"
        >
          <RankedBars
            rows={active.slice(0, 10).map((r) => ({
              name: r.customer.name,
              revenue: Math.round(r.window.spent),
              profit: Math.round(r.window.spent * 0.5),
              orders: r.window.orders,
              bottles: r.window.bottles,
            }))}
            mode={theme}
            metric="revenue"
            limit={10}
          />
        </ChartCard>
        <ChartCard title="Customers by city" subtitle="Density, not revenue — useful for local pickup routes">
          <RankedBars rows={topCities} mode={theme} metric="orders" limit={8} money={false} />
        </ChartCard>
      </div>

      <ChartCard title="When your customers order" subtitle="All orders in the selected range, by weekday and hour">
        <OrderHeatmap grid={heatmap} mode={theme} />
      </ChartCard>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'all', label: `All (${active.length})` },
            { value: 'loyal', label: 'Loyal 3+' },
            { value: 'atrisk', label: 'Dormant 60d+' },
            { value: 'local', label: 'Local' },
            { value: 'online', label: 'Online' },
          ]}
        />
      </div>

      <ChartCard
        title="Customer book"
        subtitle="Phone numbers are the primary contact channel — this is a WhatsApp business, so it stays first"
        bodyClassName="!px-0 !pb-0"
      >
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(r) => r.customer.id}
          initialSort={{ key: 'spent', dir: 'desc' }}
          searchPlaceholder="Search name, phone, city…"
          searchText={(r) => `${r.customer.name} ${r.customer.phone} ${r.customer.city}`}
          csvName="wahj-customers.csv"
          pageSize={12}
        />
      </ChartCard>

      <NoteCard
        title="Loyalty rule (local channel)"
        items={[
          'Buy 5 bottles in one cycle → the 6th is free. The dots in the table show how far each customer is into their current cycle.',
          'The counter resets when the reward is redeemed, not when the customer stops buying — so nobody loses progress by waiting.',
          'Dormant 60 days is the first place to spend WhatsApp time: they already know the brand and the bottles.',
          'Customers who buy through packs online count every bottle in the pack, including the free gift.',
        ]}
      />
    </div>
  )
}
