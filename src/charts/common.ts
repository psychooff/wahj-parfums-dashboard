import { palette, type Mode } from '../lib/theme'
import type { Granularity } from '../lib/metrics'
import { formatDay, monthKey, monthLabel, addDays, parseDay, dayKey } from '../lib/dates'

export { axisProps } from '../components/ChartTooltip'

export function useChartColors(mode: Mode) {
  return palette(mode)
}

export function bucketLabel(key: string, g: Granularity): string {
  if (g === 'month') return monthLabel(monthKey(parseDay(`${key}-01`)))
  if (g === 'week') return `Week of ${formatDay(key)}`
  return formatDay(key, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function tickLabel(key: string, g: Granularity): string {
  if (g === 'month') return monthLabel(key)
  if (g === 'week') return formatDay(key)
  return formatDay(key)
}

export function compactDH(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `${Math.round(n / 1000)}k`
  return `${Math.round(n)}`
}

export function axisMoney(n: number) {
  return compactDH(n)
}

/** Shared tooltip caption builder: "12 orders · 41 bottles". */
export function bucketCaption(orders?: number, bottles?: number): string | undefined {
  const parts: string[] = []
  if (typeof orders === 'number') parts.push(`${orders} order${orders === 1 ? '' : 's'}`)
  if (typeof bottles === 'number') parts.push(`${bottles} bottles`)
  return parts.length ? parts.join(' · ') : undefined
}

export function weekOf(key: string) {
  const d = parseDay(key)
  return dayKey(addDays(d, 6))
}

export const CHART_MARGIN = { top: 8, right: 8, left: -18, bottom: 0 }

/** Recharts animation props shared by every chart, so transitions feel identical. */
export const ANIM = {
  animationDuration: 620,
  animationEasing: 'ease-out' as const,
  animationBegin: 0,
}
