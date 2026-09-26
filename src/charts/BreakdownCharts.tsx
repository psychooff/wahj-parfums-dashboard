import { useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { SplitRow } from '../lib/metrics'
import { palette, type Mode } from '../lib/theme'
import { axisProps, ANIM, axisMoney, CHART_MARGIN } from './common'
import { ChartTooltip, makeTooltip } from '../components/ChartTooltip'
import { formatDH } from '../lib/dates'

interface DonutProps {
  rows: SplitRow[]
  mode: Mode
  metric: 'revenue' | 'profit' | 'orders' | 'bottles'
  centerLabel: string
  centerValue: string
  colors?: string[]
}

const activeShape = (mode: Mode) => (props: any) => {
  const p = palette(mode)
  return (
    <g>
      <Sector {...props} outerRadius={props.outerRadius + 6} />
      <Sector {...props} innerRadius={props.innerRadius - 3} outerRadius={props.innerRadius - 1} />
      <circle cx={props.cx} cy={props.cy} r={0} fill={p.gold} />
    </g>
  )
}

/** Donut with an interactive pop-out slice and live legend. */
export function DonutChart({ rows, mode, metric, centerLabel, centerValue, colors }: DonutProps) {
  const p = palette(mode)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const sliceColors = colors ?? [p.local, p.online, p.profit, p.series[3]]
  const data = rows.map((r, i) => ({ ...r, value: r[metric], fill: sliceColors[i % sliceColors.length] }))
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative h-[196px] w-[196px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={64}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
              activeIndex={activeIndex ?? undefined}
              activeShape={activeShape(mode)}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              {...ANIM}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as SplitRow & { fill: string; value: number }
                return (
                  <ChartTooltip
                    mode={mode}
                    title={d.name}
                    rows={[
                      { name: 'Revenue', value: Math.round(d.revenue), color: d.fill },
                      { name: 'Profit', value: Math.round(d.profit), color: p.profit, muted: true },
                      { name: 'Orders', value: d.orders, color: p.neutral, muted: true },
                    ]}
                    caption={total > 0 ? `${((d.value / total) * 100).toFixed(1)}% of the selected view` : undefined}
                  />
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-wahj-smoke">{centerLabel}</span>
          <span className="mt-0.5 font-display text-xl tnum">{centerValue}</span>
        </div>
      </div>

      <ul className="w-full space-y-2 sm:max-w-[240px]">
        {data.map((d, i) => (
          <li
            key={d.name}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 ${
              activeIndex === i ? 'bg-wahj-gold/[0.08]' : ''
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-semibold tnum">{metric === 'orders' || metric === 'bottles' ? d.value.toLocaleString('en-US') : formatDH(Math.round(d.value), { compact: true })}</span>
              <span className="block text-[10px] text-wahj-smoke tnum">
                {total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : '0%'}
                {metric === 'orders' && d.bottles ? ` · ${d.bottles} bottles` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Horizontal bars: ranks SKUs / cities without ever overlapping labels. */
export function RankedBars({
  rows,
  mode,
  metric = 'revenue',
  colorMode = 'gradient',
  limit = 8,
  money = true,
  onSelect,
}: {
  rows: SplitRow[]
  mode: Mode
  metric?: 'revenue' | 'profit' | 'orders' | 'bottles'
  colorMode?: 'gradient' | 'channel'
  limit?: number
  money?: boolean
  onSelect?: (name: string) => void
}) {
  const p = palette(mode)
  const data = [...rows].sort((a, b) => b[metric] - a[metric]).slice(0, limit).reverse()
  const max = Math.max(...data.map((d) => d[metric]), 1)

  return (
    <div className="w-full space-y-2">
      {data.map((d, i) => {
        const width = (d[metric] / max) * 100
        const color = colorMode === 'channel' ? (d.name.toLowerCase().startsWith('online') ? p.online : p.local) : p.local
        return (
          <button
            key={d.name}
            onClick={() => onSelect?.(d.name)}
            className="group block w-full text-left"
            style={{ animation: `fade-up 420ms cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${i * 45}ms` }}
          >
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-wahj-ink dark:text-wahj-sand">{d.name}</span>
              <span className="shrink-0 tnum text-wahj-smoke group-hover:text-wahj-gold">
                {money ? formatDH(Math.round(d[metric])) : `${d[metric].toLocaleString('en-US')}`}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.05]">
              <div
                className="h-full rounded-full transition-[width,background-color] duration-700 ease-smooth group-hover:brightness-110"
                style={{
                  width: `${width}%`,
                  background:
                    colorMode === 'gradient'
                      ? `linear-gradient(90deg, ${p.gold}, ${p.bright})`
                      : `linear-gradient(90deg, ${color}, ${color}cc)`,
                }}
              />
            </div>
          </button>
        )
      })}
      {!data.length && <p className="py-6 text-center text-xs text-wahj-smoke">Nothing to rank in this view.</p>}
    </div>
  )
}

/** Weekday × hour grid — the cheapest way to see when COD orders land. */
export function OrderHeatmap({ grid, mode }: { grid: number[][]; mode: Mode }) {
  const p = palette(mode)
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const cells = grid.flat()
  const max = Math.max(...cells, 1)

  return (
    <div className="w-full">
      <div className="flex gap-1 pl-8 text-[9px] text-wahj-smoke">
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="w-full text-center">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
      </div>
      <div className="mt-1 space-y-1">
        {grid.map((row, d) => (
          <div key={d} className="flex items-center gap-1">
            <span className="w-8 shrink-0 text-[10px] text-wahj-smoke">{days[d]}</span>
            {row.map((v, h) => {
              const intensity = v / max
              const isHover = hover?.d === d && hover?.h === h
              return (
                <div
                  key={h}
                  onMouseEnter={() => setHover({ d, h })}
                  onMouseLeave={() => setHover(null)}
                  title={`${days[d]} ${String(h).padStart(2, '0')}:00 — ${v} order${v === 1 ? '' : 's'}`}
                  className="h-5 w-full cursor-crosshair rounded-[4px] transition-all duration-200 ease-smooth hover:scale-[1.18]"
                  style={{
                    background:
                      intensity === 0
                        ? mode === 'dark'
                          ? 'rgba(255,255,255,0.035)'
                          : 'rgba(10,10,10,0.04)'
                        : `linear-gradient(135deg, rgba(184,86,14,${0.25 + intensity * 0.75}), rgba(201,168,76,${0.2 + intensity * 0.8}))`,
                    boxShadow: isHover ? `0 0 0 1.5px ${p.gold}` : undefined,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-wahj-smoke">
        <span>Order volume by weekday and hour</span>
        <span className="flex items-center gap-1.5">
          quiet
          <span className="h-2 w-16 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(184,86,14,0.5), rgba(201,168,76,0.95))' }} />
          busy
        </span>
      </div>
    </div>
  )
}

/** Compact bar chart used where a full chart would be too heavy (e.g. orders per bucket). */
export function MiniBarChart({ data, mode, color }: { data: Array<{ label: string; value: number }>; mode: Mode; color?: string }) {
  const p = palette(mode)
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ ...CHART_MARGIN, left: -24 }}>
          <CartesianGrid strokeDasharray="3 6" stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps(mode)} minTickGap={20} />
          <YAxis {...axisProps(mode)} tickFormatter={axisMoney} width={52} />
          <Tooltip
            cursor={{ fill: 'rgba(201,168,76,0.07)' }}
            content={makeTooltip(mode, { rows: (payload) => {
              const point = payload?.[0]?.payload as { label: string; value: number } | undefined
              return point ? [{ name: point.label, value: point.value, color: color ?? p.gold }] : []
            } })}
          />
          <Bar dataKey="value" fill={color ?? p.gold} radius={[4, 4, 0, 0]} maxBarSize={30} {...ANIM} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
