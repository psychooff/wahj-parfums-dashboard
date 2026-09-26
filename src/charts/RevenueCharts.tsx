import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Bucket, Granularity } from '../lib/metrics'
import { palette, type Mode } from '../lib/theme'
import { axisProps, ANIM, axisMoney, bucketCaption, bucketLabel, CHART_MARGIN, tickLabel } from './common'
import { makeTooltip } from '../components/ChartTooltip'

interface Props {
  buckets: Bucket[]
  mode: Mode
  granularity: Granularity
  showProfit?: boolean
}

/**
 * Bar = revenue split by channel, line = what actually stayed in the business.
 * Hover gives the full breakdown; the bars grow in on every filter change.
 */
export function RevenueChart({ buckets, mode, granularity, showProfit = true }: Props) {
  const p = palette(mode)
  const data = buckets.map((b) => ({ ...b, label: tickLabel(b.key, granularity) }))

  return (
    <div className="h-[300px] w-full sm:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ ...CHART_MARGIN, left: -22, right: 6 }}>
          <defs>
            <linearGradient id="barLocal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.bright} stopOpacity={0.95} />
              <stop offset="100%" stopColor={p.local} stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="barOnline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.online} stopOpacity={0.95} />
              <stop offset="100%" stopColor={p.online} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps(mode)} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axisProps(mode)} tickFormatter={axisMoney} width={54} />
          <Tooltip
            cursor={{ fill: 'rgba(201,168,76,0.06)' }}
            content={makeTooltip(mode, {
              label: (label) => label,
              rows: (payload) => {
                const point = payload?.[0]?.payload as (Bucket & { label: string }) | undefined
                if (!point) return []
                return [
                  { name: 'Local revenue', value: point.localRevenue, color: p.local },
                  { name: 'Online revenue', value: point.onlineRevenue, color: p.online },
                  { name: 'Net profit', value: point.profit, color: p.profit },
                  { name: 'Costs', value: point.cost, color: p.neutral, muted: true },
                ]
              },
              caption: (payload) => {
                const point = payload?.[0]?.payload as (Bucket & { label: string }) | undefined
                return point ? bucketCaption(point.orders, point.bottles) : undefined
              },
            })}
          />
          <Legend
            verticalAlign="top"
            height={30}
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, color: p.axis, paddingBottom: 6 }}
          />
          <Bar dataKey="localRevenue" name="Local" stackId="rev" fill="url(#barLocal)" radius={[0, 0, 0, 0]} maxBarSize={38} {...ANIM} />
          <Bar dataKey="onlineRevenue" name="Online" stackId="rev" fill="url(#barOnline)" radius={[4, 4, 0, 0]} maxBarSize={38} {...ANIM} />
          {showProfit && (
            <Line
              type="monotone"
              dataKey="profit"
              name="Net profit"
              stroke={p.profit}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: p.tooltipBg }}
              {...ANIM}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Local vs online profit trend — two areas, so the channel story is unmissable. */
export function ProfitAreaChart({ buckets, mode, granularity }: Props) {
  const p = palette(mode)
  const data = buckets.map((b) => {
    const localOrders = b.orders - 0
    return {
      label: tickLabel(b.key, granularity),
      localProfit: Math.round(b.localRevenue - b.cost * (b.localRevenue / Math.max(1, b.revenue))),
      onlineProfit: Math.round(b.onlineRevenue - b.cost * (b.onlineRevenue / Math.max(1, b.revenue))),
      orders: localOrders,
      bottles: b.bottles,
    }
  })

  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ ...CHART_MARGIN, left: -22, right: 6 }}>
          <defs>
            <linearGradient id="areaLocal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.local} stopOpacity={0.5} />
              <stop offset="100%" stopColor={p.local} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="areaOnline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.online} stopOpacity={0.5} />
              <stop offset="100%" stopColor={p.online} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps(mode)} minTickGap={24} />
          <YAxis {...axisProps(mode)} tickFormatter={axisMoney} width={54} />
          <Tooltip
            content={makeTooltip(mode, {
              rows: (payload) => {
                const point = payload?.[0]?.payload as { localProfit: number; onlineProfit: number; orders: number; bottles: number } | undefined
                if (!point) return []
                return [
                  { name: 'Local profit', value: point.localProfit, color: p.local },
                  { name: 'Online profit', value: point.onlineProfit, color: p.online },
                ]
              },
              caption: (payload) => {
                const point = payload?.[0]?.payload as { orders: number; bottles: number } | undefined
                return point ? bucketCaption(point.orders, point.bottles) : undefined
              },
            })}
          />
          <Legend verticalAlign="top" height={28} iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: p.axis }} />
          <Area type="monotone" dataKey="localProfit" name="Local profit" stroke={p.local} fill="url(#areaLocal)" strokeWidth={2} {...ANIM} />
          <Area type="monotone" dataKey="onlineProfit" name="Online profit" stroke={p.online} fill="url(#areaOnline)" strokeWidth={2} {...ANIM} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Cumulative profit inside the selected window — "is the month on track?" */
export function CumulativeChart({ buckets, mode }: { buckets: Bucket[]; mode: Mode }) {
  const p = palette(mode)
  let revenue = 0
  const data = buckets.map((b) => {
    revenue += b.revenue
    return { label: bucketLabel(b.key, 'day').replace(/^[A-Za-z]+,?\s/, ''), revenue: Math.round(revenue), orders: b.orders }
  })

  return (
    <div className="h-[190px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ ...CHART_MARGIN, left: -24, right: 6 }}>
          <defs>
            <linearGradient id="cumArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.bright} stopOpacity={0.45} />
              <stop offset="100%" stopColor={p.ember} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps(mode)} minTickGap={28} />
          <YAxis {...axisProps(mode)} tickFormatter={axisMoney} width={52} />
          <Tooltip
            content={makeTooltip(mode, {
              rows: (payload) => {
                const point = payload?.[0]?.payload as { revenue: number } | undefined
                return point ? [{ name: 'Cumulative revenue', value: point.revenue, color: p.local }] : []
              },
            })}
          />
          <Area type="monotone" dataKey="revenue" name="Cumulative revenue" stroke={p.bright} fill="url(#cumArea)" strokeWidth={2} {...ANIM} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
