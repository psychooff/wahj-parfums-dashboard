import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDashboard } from '../state/store'
import { formatDay } from '../lib/dates'
import {
  IconAlert,
  IconBox,
  IconChart,
  IconClose,
  IconCoins,
  IconGear,
  IconLayers,
  IconMenu,
  IconMoon,
  IconSpark,
  IconSun,
  IconUsers,
  IconDownload,
} from './icons'

export type ScreenId = 'overview' | 'sales' | 'products' | 'stock' | 'finance' | 'customers' | 'data' | 'settings'

/** Lets any screen jump to another one (e.g. an "import your CSV" call to action). */
export const NavContext = createContext<(id: ScreenId) => void>(() => {})
export const useNavigate = () => useContext(NavContext)

export const SCREENS: Array<{ id: ScreenId; label: string; caption: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', caption: 'The whole business at a glance', icon: <IconSpark className="h-4 w-4" /> },
  { id: 'sales', label: 'Sales', caption: 'Orders, cities and buying rhythm', icon: <IconChart className="h-4 w-4" /> },
  { id: 'products', label: 'Products & Packs', caption: 'SKU performance and pack economics', icon: <IconBox className="h-4 w-4" /> },
  { id: 'stock', label: 'Stock & Maceration', caption: 'Sellable vs. what is still cooking', icon: <IconLayers className="h-4 w-4" /> },
  { id: 'finance', label: 'Finance', caption: 'Two-channel P&L and allocation', icon: <IconCoins className="h-4 w-4" /> },
  { id: 'customers', label: 'Customers', caption: 'Repeat buyers and loyalty cycles', icon: <IconUsers className="h-4 w-4" /> },
  { id: 'data', label: 'Data & Photos', caption: 'Import your CSV, add product pictures', icon: <IconDownload className="h-4 w-4" /> },
  { id: 'settings', label: 'Business Rules', caption: 'Delivery, returns, triggers, allocation', icon: <IconGear className="h-4 w-4" /> },
]

function Wordmark() {
  return (
    <div className="relative flex items-center gap-3">
      <span className="pointer-events-none absolute -left-6 -top-6 h-20 w-20 rounded-full bg-wahj-ember/40 blur-2xl" aria-hidden />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-wahj-gold/30 bg-wahj-black shadow-ember">
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
          <defs>
            <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E4C56B" />
              <stop offset="55%" stopColor="#C9A84C" />
              <stop offset="100%" stopColor="#B8560E" />
            </linearGradient>
          </defs>
          <path d="M16 4c3.4 5.6 6.6 8.4 6.6 12.8A6.6 6.6 0 0 1 9.4 16.8C9.4 12.4 12.6 9.6 16 4Z" fill="url(#flame)" />
          <path d="M16 24.5a3 3 0 0 0 3-3c0-1.9-1.4-3-3-5.3-1.6 2.3-3 3.4-3 5.3a3 3 0 0 0 3 3Z" fill="#0A0A0A" opacity="0.55" />
        </svg>
      </span>
      <span className="relative leading-tight">
        <span className="block font-arabic text-[13px] text-wahj-gold/90">وهج</span>
        <span className="block font-display text-sm tracking-[0.22em] text-wahj-sand dark:text-wahj-sand">WAHJ PARFUMS</span>
      </span>
    </div>
  )
}

function NavList({ active, onSelect }: { active: ScreenId; onSelect: (id: ScreenId) => void }) {
  const { openAlerts, activeFilterCount } = useDashboard()
  return (
    <nav className="flex flex-col gap-1">
      {SCREENS.map((s) => {
        const isActive = active === s.id
        const badge = s.id === 'stock' && openAlerts.length ? openAlerts.length : s.id === 'finance' && activeFilterCount > 1 ? activeFilterCount : null
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ease-smooth ${
              isActive
                ? 'bg-gradient-to-r from-wahj-gold/[0.16] to-transparent text-wahj-ink dark:text-wahj-bright'
                : 'text-wahj-smoke hover:bg-black/[0.03] hover:text-wahj-ink dark:hover:bg-white/[0.04] dark:hover:text-wahj-sand'
            }`}
          >
            {isActive && <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-wahj-gold shadow-ember" />}
            <span className={isActive ? 'text-wahj-gold' : 'text-wahj-smoke group-hover:text-wahj-gold/80'}>{s.icon}</span>
            <span className="flex-1">
              <span className="block text-[13px] font-medium">{s.label}</span>
              <span className="hidden text-[10px] text-wahj-smoke/80 lg:block">{s.caption}</span>
            </span>
            {badge !== null && (
              <span className="rounded-full bg-wahj-ember/20 px-1.5 py-0.5 text-[10px] font-semibold text-wahj-bright tnum">{badge}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

export function Shell({
  active,
  onSelect,
  children,
}: {
  active: ScreenId
  onSelect: (id: ScreenId) => void
  children: ReactNode
}) {
  const { theme, toggleTheme, lastUpdated, refreshing, dataSource, dataset } = useDashboard()
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const screen = SCREENS.find((s) => s.id === active)!

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-black/[0.06] bg-white/60 px-4 py-5 backdrop-blur-xl dark:border-white/[0.06] dark:bg-wahj-ink/40 lg:flex">
        <Wordmark />
        <div className="mt-7 flex-1 overflow-y-auto">
          <NavList active={active} onSelect={onSelect} />
        </div>
        <div className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-[11px] leading-relaxed text-wahj-smoke dark:border-white/[0.06] dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 font-medium text-wahj-ink dark:text-wahj-sand">
            <span className={`h-1.5 w-1.5 rounded-full ${refreshing ? 'bg-wahj-gold animate-pulse-soft' : 'bg-pos'}`} />
            {dataSource === 'imported' ? 'Your imported data' : 'Live sample data'}
          </div>
          <p className="mt-1.5">
            {dataSource === 'imported'
              ? `${dataset.orders.length.toLocaleString('en-US')} orders · ${dataset.historyStart} → ${dataset.historyEnd}`
              : 'Simulated from your v1 rules · 18 months'}{' '}
            · {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-wahj-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 w-[268px] animate-fade-in border-r border-white/[0.08] bg-wahj-black px-4 py-5">
            <div className="flex items-center justify-between">
              <Wordmark />
              <button onClick={() => setMobileOpen(false)} className="btn-ghost btn p-2" aria-label="Close menu">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6">
              <NavList
                active={active}
                onSelect={(id) => {
                  onSelect(id)
                  setMobileOpen(false)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-wahj-paper/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-wahj-black/75">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setMobileOpen(true)} className="btn p-2 lg:hidden" aria-label="Open menu">
              <IconMenu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg tracking-tight sm:text-xl">{screen.label}</h1>
              <p className="hidden truncate text-[11px] text-wahj-smoke sm:block">{screen.caption}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="btn group relative overflow-hidden p-2"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
            >
              <span className={`transition-transform duration-500 ease-smooth ${theme === 'dark' ? 'rotate-0' : 'rotate-180'}`}>
                {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
              </span>
            </button>
          </div>
        </header>

        {/* No key here on purpose: the table keeps its sort/search state while data flows in. */}
        <main className="animate-fade-up flex-1 px-3 pb-14 pt-4 sm:px-6 sm:pb-10">
          <div className={refreshing ? 'opacity-[0.86] transition-opacity duration-200' : 'opacity-100 transition-opacity duration-300'}>{children}</div>
        </main>
      </div>
    </div>
  )
}

export function RangeSummary() {
  const { filters, rangeDays, prevRange, refreshing, orders } = useDashboard()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-wahj-smoke">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${refreshing ? 'bg-wahj-gold animate-pulse-soft' : 'bg-pos'}`} />
        Live
      </span>
      <span className="tnum">
        {formatDay(filters.from)} → {formatDay(filters.to)} · {rangeDays} days
      </span>
      <span className="hidden sm:inline">
        vs {formatDay(prevRange.from)} → {formatDay(prevRange.to)}
      </span>
      <span className="tnum">
        {orders.filter((o) => o.status !== 'cancelled').length.toLocaleString('en-US')} orders in view
      </span>
    </div>
  )
}

export function AlertChip() {
  const { openAlerts } = useDashboard()
  if (!openAlerts.length) return null
  return (
    <span className="badge border border-warn/30 bg-warn/[0.14] text-warn">
      <IconAlert className="h-3 w-3" />
      {openAlerts.length} reorder alert{openAlerts.length > 1 ? 's' : ''}
    </span>
  )
}
