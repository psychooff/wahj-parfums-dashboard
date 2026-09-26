import type { TooltipProps } from 'recharts'
import { palette, type Mode } from '../lib/theme'

export interface TooltipRow {
  name: string
  value: number
  color?: string
  /** Render as a secondary line (e.g. "of which Online"). */
  muted?: boolean
}

/**
 * One tooltip look across every chart: ember-glow border, tabular numbers,
 * a small caption line for context (e.g. how many orders are behind the bar).
 */
export function ChartTooltip({
  title,
  rows,
  caption,
  mode,
}: {
  title: string
  rows: TooltipRow[]
  caption?: string
  mode: Mode
}) {
  const p = palette(mode)
  return (
    <div
      className="min-w-[168px] rounded-xl border px-3 py-2 shadow-xl backdrop-blur"
      style={{ background: p.tooltipBg, borderColor: p.tooltipBorder }}
    >
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: p.axis }}>
        {title}
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className={`flex items-center justify-between gap-4 text-xs ${r.muted ? 'opacity-70' : ''}`}>
            <span className="flex items-center gap-1.5" style={{ color: p.text }}>
              {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
              {r.name}
            </span>
            <span className="tnum font-semibold" style={{ color: p.text }}>
              {r.value.toLocaleString('en-US', { maximumFractionDigits: 0 })} DH
            </span>
          </div>
        ))}
      </div>
      {caption && (
        <div className="mt-1.5 border-t pt-1.5 text-[11px]" style={{ borderColor: p.grid, color: p.axis }}>
          {caption}
        </div>
      )}
    </div>
  )
}

/** Recharts adapter — keeps chart files free of tooltip markup. */
export function makeTooltip(
  mode: Mode,
  config: {
    label?: (label: string) => string
    rows?: (payload: TooltipProps<number, string>['payload']) => TooltipRow[]
    caption?: (payload: TooltipProps<number, string>['payload']) => string | undefined
    unitRows?: boolean
  } = {},
) {
  const p = palette(mode)
  return function Tooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null
    const rows: TooltipRow[] =
      config.rows?.(payload) ??
      payload
        .filter((entry) => typeof entry.value === 'number')
        .map((entry) => ({
          name: String(entry.name ?? ''),
          value: Number(entry.value ?? 0),
          color: (entry.color as string) ?? p.gold,
        }))
    return (
      <ChartTooltip
        title={config.label ? config.label(String(label)) : String(label)}
        rows={rows}
        caption={config.caption?.(payload)}
        mode={mode}
      />
    )
  }
}

export function axisProps(mode: Mode) {
  const p = palette(mode)
  return {
    tick: { fill: p.axis, fontSize: 11 },
    stroke: p.grid,
    tickLine: false,
    axisLine: false,
  }
}
