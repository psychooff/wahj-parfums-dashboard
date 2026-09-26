import type { ReactNode } from 'react'
import { useDashboard } from '../state/store'
import { NumberTicker } from './NumberTicker'
import { Sparkline, TrendBadge } from './Sparkline'

export type Accent = 'gold' | 'ember' | 'sage' | 'neutral' | 'violet'

const ACCENTS: Record<Accent, { hex: string; glow: string; ring: string }> = {
  gold: { hex: '#C9A84C', glow: 'before:bg-wahj-gold/20', ring: 'group-hover:ring-wahj-gold/40' },
  ember: { hex: '#B8560E', glow: 'before:bg-wahj-ember/25', ring: 'group-hover:ring-wahj-ember/40' },
  sage: { hex: '#7FB69A', glow: 'before:bg-[#7FB69A]/20', ring: 'group-hover:ring-[#7FB69A]/40' },
  neutral: { hex: '#9A968D', glow: 'before:bg-wahj-smoke/15', ring: 'group-hover:ring-wahj-smoke/40' },
  violet: { hex: '#8C7BC7', glow: 'before:bg-[#8C7BC7]/20', ring: 'group-hover:ring-[#8C7BC7]/40' },
}

export interface KpiCardProps {
  label: string
  value: number
  format: (n: number) => string
  delta?: number | null
  deltaLabel?: string
  invertDelta?: boolean
  spark?: number[]
  accent?: Accent
  hint?: ReactNode
  icon?: ReactNode
  /** Renders the "live data" shimmer while filters settle. */
  loading?: boolean
}

export function KpiCard({
  label,
  value,
  format,
  delta = null,
  deltaLabel,
  invertDelta = false,
  spark,
  accent = 'gold',
  hint,
  icon,
  loading = false,
}: KpiCardProps) {
  const { refreshing } = useDashboard()
  const a = ACCENTS[accent]
  const busy = loading || refreshing

  return (
    <div
      className={`card group overflow-hidden card-pad before:pointer-events-none before:absolute before:-right-10 before:-top-12 before:h-32 before:w-32 before:rounded-full before:blur-2xl before:transition-opacity before:duration-500 ${a.glow} hover:ring-1 ${a.ring} hover:-translate-y-0.5 transition-transform duration-300 ease-smooth`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.06] bg-black/[0.03] dark:border-white/[0.07] dark:bg-white/[0.04]"
              style={{ color: a.hex }}
            >
              {icon}
            </span>
          )}
          <span className="card-title">{label}</span>
        </div>
        <TrendBadge delta={delta} invert={invertDelta} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className={`font-display text-[26px] leading-none tracking-tight tnum sm:text-[30px] ${busy ? 'opacity-70' : 'opacity-100'} transition-opacity duration-200`}>
          <NumberTicker value={value} format={format} />
        </div>
        {spark && spark.length > 1 && (
          <div className="w-24 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity duration-300">
            <Sparkline data={spark} color={a.hex} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-wahj-smoke">
        {hint ?? <span>{deltaLabel}</span>}
      </div>
    </div>
  )
}
