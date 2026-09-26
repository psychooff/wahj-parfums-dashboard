import type { ReactNode } from 'react'

export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
  footer,
  style,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  footer?: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <section className={`card flex flex-col ${className}`} style={style}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-wahj-smoke">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={`min-w-0 flex-1 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 ${bodyClassName}`}>{children}</div>
      {footer && <div className="border-t border-black/[0.06] px-4 py-3 text-[11px] text-wahj-smoke dark:border-white/[0.06] sm:px-5">{footer}</div>}
    </section>
  )
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-xl border border-black/[0.08] bg-black/[0.03] p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[10px] font-medium transition-all duration-200 ease-smooth ${
            size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          } ${
            value === o.value
              ? 'bg-white text-wahj-ink shadow-sm dark:bg-wahj-gold/[0.18] dark:text-wahj-bright'
              : 'text-wahj-smoke hover:text-wahj-ink dark:hover:text-wahj-sand'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StatusPill({
  tone,
  children,
  pulse = false,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral'
  children: ReactNode
  pulse?: boolean
}) {
  const tones = {
    ok: 'bg-pos/[0.14] text-pos border-pos/25',
    warn: 'bg-warn/[0.14] text-warn border-warn/25',
    bad: 'bg-neg/[0.14] text-neg border-neg/25',
    info: 'bg-wahj-gold/[0.14] text-wahj-gold border-wahj-gold/30',
    neutral: 'bg-black/[0.05] text-wahj-smoke border-black/[0.06] dark:bg-white/[0.06] dark:border-white/[0.08]',
  }
  return (
    <span className={`badge border ${tones[tone]}`}>
      {pulse && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />}
      {children}
    </span>
  )
}
