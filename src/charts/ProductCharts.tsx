import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import type { StockRow } from '../lib/types'
import type { PerfumeStat } from '../lib/metrics'
import { palette, type Mode } from '../lib/theme'
import { axisProps, ANIM } from './common'
import { ChartTooltip, makeTooltip } from '../components/ChartTooltip'
import { formatDH } from '../lib/dates'

/**
 * Sellable vs. macerating, per SKU, against that class's reorder trigger.
 * This is the "sellable stock ≠ total stock" rule made visual.
 */
export function StockMixChart({ rows, mode, limit = 12 }: { rows: StockRow[]; mode: Mode; limit?: number }) {
  const p = palette(mode)
  const data = rows
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((r) => ({
      name: r.perfume.name,
      brand: r.perfume.brand,
      sellable: r.sellable,
      macerating: r.macerating,
      trigger: r.trigger,
      status: r.reorderStatus,
      ready: r.nextReadyInDays,
    }))

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 6" stroke={p.grid} horizontal={false} />
          <XAxis type="number" {...axisProps(mode)} allowDecimals={false} />
          <YAxis type="category" dataKey="name" {...axisProps(mode)} width={104} tick={{ fill: p.axis, fontSize: 10.5 }} />
          <Tooltip
            cursor={{ fill: 'rgba(201,168,76,0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as (typeof data)[number]
              return (
                <ChartTooltip
                  mode={mode}
                  title={`${d.name} · ${d.brand}`}
                  rows={[
                    { name: 'Sellable now', value: d.sellable, color: p.local },
                    { name: 'Macerating', value: d.macerating, color: p.online },
                    { name: 'Reorder trigger', value: d.trigger, color: p.neutral, muted: true },
                  ]}
                  caption={
                    d.ready !== null
                      ? d.ready <= 0
                        ? 'A batch is ready — confirm it into sellable stock'
                        : `Next batch ready in ${d.ready} days`
                      : 'No batch in maceration'
                  }
                />
              )
            }}
          />
          <Legend verticalAlign="top" height={26} iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: p.axis }} />
          <ReferenceLine x={0} stroke={p.grid} />
          <Bar dataKey="sellable" name="Sellable" stackId="stock" fill={p.local} radius={[3, 0, 0, 3]} {...ANIM} />
          <Bar dataKey="macerating" name="Macerating (not sellable)" stackId="stock" fill={p.online} radius={[0, 3, 3, 0]} {...ANIM} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Price vs. real margin per pack, bubble = units sold in the window. */
export function PackMarginScatter({
  rows,
  mode,
}: {
  rows: Array<{ name: string; price: number; margin: number; units: number; profit: number }>
  mode: Mode
}) {
  const p = palette(mode)
  const data = rows.map((r) => ({ ...r, z: Math.max(20, r.units * 6) }))

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 6" stroke={p.grid} />
          <XAxis
            type="number"
            dataKey="price"
            name="Pack price"
            {...axisProps(mode)}
            domain={['dataMin - 20', 'dataMax + 20']}
            tickFormatter={(v) => `${v}`}
          />
          <YAxis type="number" dataKey="margin" name="Margin" {...axisProps(mode)} unit="%" width={46} />
          <ZAxis type="number" dataKey="z" range={[60, 320]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: p.gold }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as (typeof data)[number]
              return (
                <ChartTooltip
                  mode={mode}
                  title={d.name}
                  rows={[
                    { name: 'Price', value: d.price, color: p.local },
                    { name: 'Profit / unit', value: d.profit, color: p.profit },
                    { name: 'Units sold', value: d.units, color: p.neutral, muted: true },
                  ]}
                  caption={`Margin ${d.margin.toFixed(1)}% after delivery + 15% return provision`}
                />
              )
            }}
          />
          <ReferenceLine y={0} stroke={p.neutral} strokeDasharray="4 4" />
          <Scatter name="Packs" data={data} fill={p.local} {...ANIM}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.margin < 25 ? p.online : d.margin < 45 ? p.bright : p.profit}
                fillOpacity={0.85}
                stroke={p.tooltipBorder}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Where the pack price actually goes: production, delivery, return provision, profit. */
export function PackEconomicsBars({
  rows,
  mode,
}: {
  rows: Array<{ name: string; production: number; delivery: number; provision: number; profit: number }>
  mode: Mode
}) {
  const p = palette(mode)
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 20, left: 8, bottom: 0 }} barSize={16}>
          <CartesianGrid strokeDasharray="3 6" stroke={p.grid} horizontal={false} />
          <XAxis type="number" {...axisProps(mode)} tickFormatter={(v) => `${v}`} />
          <YAxis type="category" dataKey="name" {...axisProps(mode)} width={120} tick={{ fill: p.axis, fontSize: 10.5 }} />
          <Tooltip
            cursor={{ fill: 'rgba(201,168,76,0.06)' }}
            content={makeTooltip(mode)}
          />
          <Legend verticalAlign="top" height={26} iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: p.axis }} />
          <Bar dataKey="production" stackId="a" name="Production (5 bottles)" fill={p.series[3]} {...ANIM} />
          <Bar dataKey="delivery" stackId="a" name="Delivery absorbed" fill={p.neutral} {...ANIM} />
          <Bar dataKey="provision" stackId="a" name="Return provision 15%" fill={p.online} {...ANIM} />
          <Bar dataKey="profit" stackId="a" name="Net profit" fill={p.profit} radius={[0, 4, 4, 0]} {...ANIM} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** SKU revenue ranking with a profit overlay — shows which heroes carry the business. */
export function PerfumeRevenueChart({ rows, mode, limit = 10 }: { rows: PerfumeStat[]; mode: Mode; limit?: number }) {
  const p = palette(mode)
  const data = rows.slice(0, limit).map((r) => ({
    name: r.perfume.name,
    brand: r.perfume.brand,
    abc: r.perfume.abcClass,
    revenue: Math.round(r.revenue),
    profit: Math.round(r.profit),
    bottles: r.bottles,
    unitCost: r.perfume.unitCost30ml,
  }))

  return (
    <div className="h-[330px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, left: 8, bottom: 0 }} barSize={13}>
          <CartesianGrid strokeDasharray="3 6" stroke={p.grid} horizontal={false} />
          <XAxis type="number" {...axisProps(mode)} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
          <YAxis type="category" dataKey="name" {...axisProps(mode)} width={108} tick={{ fill: p.axis, fontSize: 10.5 }} />
          <Tooltip
            cursor={{ fill: 'rgba(201,168,76,0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as (typeof data)[number]
              return (
                <ChartTooltip
                  mode={mode}
                  title={`${d.name} · ${d.brand}`}
                  rows={[
                    { name: 'Revenue', value: d.revenue, color: p.local },
                    { name: 'Gross profit', value: d.profit, color: p.profit },
                  ]}
                  caption={`Class ${d.abc} · ${d.bottles} bottles · ${formatDH(d.unitCost, { decimals: 2 })}/bottle cost`}
                />
              )
            }}
          />
          <Legend verticalAlign="top" height={26} iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: p.axis }} />
          <Bar dataKey="revenue" name="Revenue" fill={p.local} radius={[0, 3, 3, 0]} {...ANIM} />
          <Bar dataKey="profit" name="Gross profit" fill={p.profit} radius={[0, 3, 3, 0]} {...ANIM} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
