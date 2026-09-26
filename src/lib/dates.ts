const DAY_MS = 86400000

/** All dates in the app are handled at UTC midnight to keep range filters timezone-proof. */
export function startOfDay(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function dayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date | string, n: number): Date {
  const base = typeof d === 'string' ? parseDay(d) : d
  return new Date(base.getTime() + n * DAY_MS)
}

/** Whole days from a → b (positive when b is later). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

export function monthKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

export function formatDay(key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return parseDay(key).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' })
}

export function formatDateLong(key: string): string {
  return parseDay(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function relativeDays(isoOrKey: string): string {
  const target = isoOrKey.length <= 10 ? parseDay(isoOrKey) : startOfDay(isoOrKey)
  const diff = daysBetween(startOfDay(new Date()), target)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff > 1) return `in ${diff} days`
  if (diff === -1) return 'yesterday'
  if (diff > -30) return `${Math.abs(diff)} days ago`
  if (diff > -365) return `${Math.round(Math.abs(diff) / 30)} months ago`
  return `${(Math.abs(diff) / 365).toFixed(1)} years ago`
}

export function formatDH(n: number, opts: { compact?: boolean; decimals?: number } = {}): string {
  const { compact = false, decimals = 0 } = opts
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M DH`
    if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}k DH`
  }
  return `${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} DH`
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}
