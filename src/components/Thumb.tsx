import { useState } from 'react'
import { useMedia } from '../state/media'
import type { Perfume } from '../lib/types'

const initials = (perfume: Perfume) =>
  `${perfume.name.charAt(0)}${perfume.brand && perfume.brand !== '—' ? perfume.brand.charAt(0) : ''}`.toUpperCase()

const HUE_FROM = (perfume: Perfume) => {
  const seed = [...perfume.id].reduce((s, c) => s + c.charCodeAt(0), 0)
  return (seed * 37) % 360
}

/**
 * Product photo with a graceful monogram fallback, so the dashboard looks
 * complete even before a single image has been uploaded.
 */
export function Thumb({
  perfume,
  size = 40,
  className = '',
  rounded = 'rounded-xl',
  glow = false,
}: {
  perfume: Perfume
  size?: number
  className?: string
  rounded?: string
  glow?: boolean
}) {
  const { images } = useMedia()
  const [broken, setBroken] = useState(false)
  const src = images[perfume.id]
  const hue = HUE_FROM(perfume)

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-black/[0.06] dark:border-white/[0.08] ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && <span className="pointer-events-none absolute inset-0 bg-wahj-ember/25 blur-md" aria-hidden />}
      {src && !broken ? (
        <img
          src={src}
          alt={perfume.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className="relative h-full w-full object-cover transition-transform duration-500 ease-smooth hover:scale-105"
        />
      ) : (
        <span
          className="relative flex h-full w-full items-center justify-center font-display font-semibold"
          style={{
            fontSize: size * 0.38,
            background: `linear-gradient(140deg, hsl(${hue} 32% 22%), hsl(${(hue + 40) % 360} 45% 12%))`,
            color: '#E4C56B',
          }}
          aria-label={perfume.name}
        >
          {initials(perfume)}
        </span>
      )}
    </span>
  )
}

export function ProductCell({ perfume, subtitle }: { perfume: Perfume; subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Thumb perfume={perfume} size={38} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{perfume.name}</span>
        <span className="truncate text-[10.5px] text-wahj-smoke">{subtitle ?? `${perfume.brand} · ${perfume.gender}`}</span>
      </span>
    </span>
  )
}
