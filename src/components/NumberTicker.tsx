import { useEffect, useRef, useState } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Eases a number from its previous value to the new one, so KPI cards visibly
 * "settle" whenever the date range or a segment changes.
 */
export function NumberTicker({
  value,
  format,
  duration = 700,
  className,
}: {
  value: number
  format: (n: number) => string
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (prefersReduced()) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const from = fromRef.current
    const delta = value - from
    if (delta === 0) return
    const startedAt = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + delta * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
      else fromRef.current = value
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = value
    }
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
