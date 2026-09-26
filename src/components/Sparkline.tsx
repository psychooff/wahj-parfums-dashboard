import type { ReactNode } from 'react'

export interface SparkPoint {
  value: number
}

/** Tiny trend line used inside KPI cards — no axes, just the shape of the story. */
export function Sparkline({
  data,
  color = '#C9A84C',
  height = 38,
  className = '',
  showArea = true,
}: {
  data: number[]
  color?: string
  height?: number
  className?: string
  showArea?: boolean
}) {
  if (!data.length) return null
  const w = 100
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w
    const y = height - ((v - min) / span) * (height - 6) - 3
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const line = `M ${points.join(' L ')}`
  const area = `${line} L ${w},${height} L 0,${height} Z`
  const id = `spark-${color.replace('#', '')}-${data.length}`

  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={className} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function TrendBadge({
  delta,
  invert = false,
  suffix = '',
  children,
}: {
  delta: number | null
  invert?: boolean
  suffix?: string
  children?: ReactNode
}) {
  if (delta === null || !Number.isFinite(delta)) {
    return <span className="badge bg-black/[0.05] text-wahj-smoke dark:bg-white/[0.06]">— no prior data</span>
  }
  const good = invert ? delta < 0 : delta > 0
  const flat = Math.abs(delta) < 0.6
  const tone = flat
    ? 'bg-black/[0.05] text-wahj-smoke dark:bg-white/[0.06] dark:text-wahj-sand/70'
    : good
      ? 'bg-pos/[0.14] text-pos'
      : 'bg-neg/[0.14] text-neg'
  const arrow = flat ? '→' : delta > 0 ? '▲' : '▼'

  return (
    <span className={`badge ${tone} tnum`} title={children ? undefined : `${delta > 0 ? '+' : ''}${delta}%`}>
      <span className="text-[9px] leading-none">{arrow}</span>
      {Math.abs(delta).toFixed(1)}%{suffix}
      {children}
    </span>
  )
}
