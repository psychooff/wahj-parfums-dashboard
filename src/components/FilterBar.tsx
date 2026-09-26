import { useState } from 'react'
import { useDashboard } from '../state/store'
import type { ABCClass, Gender, RangePreset } from '../lib/types'
import { classRank } from '../data/generate'
import { IconClose, IconFlame } from './icons'
import { RangeSummary } from './Shell'

const PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' },
]

const CLASSES: ABCClass[] = ['A', 'B', 'C']
const CLASS_HINT: Record<ABCClass, string> = {
  A: 'Hero SKUs · reorder at 8 bottles',
  B: 'Steady sellers · reorder at 5 bottles',
  C: 'Long tail · reorder at 3 bottles',
}

export function FilterBar({ compact = false }: { compact?: boolean }) {
  const { filters, setPreset, setCustomRange, toggleChannel, toggleClass, toggleGender, resetFilters, activeFilterCount } =
    useDashboard()
  const [expanded, setExpanded] = useState(false)

  // Details are always visible unless the host screen asked for a compact bar,
  // in which case the toggle below reveals them.
  const showDetails = !compact || expanded

  return (
    <div className="card mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
        {/* Range presets */}
        <div className="flex items-center gap-1 rounded-xl border border-black/[0.08] bg-black/[0.03] p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 ease-smooth ${
                filters.preset === p.value
                  ? 'bg-gradient-to-b from-wahj-bright to-wahj-gold text-wahj-black shadow-[0_4px_14px_-6px_rgba(201,168,76,0.9)]'
                  : 'text-wahj-smoke hover:text-wahj-ink dark:hover:text-wahj-sand'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom dates */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(e) => setCustomRange(e.target.value, filters.to)}
            className={`input w-[8.6rem] py-1.5 text-[11px] tnum ${filters.preset === 'custom' ? 'border-wahj-gold/70' : ''}`}
            aria-label="From date"
          />
          <span className="text-wahj-smoke">→</span>
          <input
            type="date"
            value={filters.to}
            min={filters.from}
            onChange={(e) => setCustomRange(filters.from, e.target.value)}
            className={`input w-[8.6rem] py-1.5 text-[11px] tnum ${filters.preset === 'custom' ? 'border-wahj-gold/70' : ''}`}
            aria-label="To date"
          />
        </div>

        {/* Channels — the two-channel rule from the strategy doc */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => toggleChannel('LOCAL')}
            className={`chip ${filters.channels.includes('LOCAL') ? 'chip-active' : ''}`}
            title="Local: singles & 2-packs, no delivery fee, no return provision"
          >
            <span className="h-2 w-2 rounded-full bg-wahj-gold" />
            Local
          </button>
          <button
            onClick={() => toggleChannel('ONLINE')}
            className={`chip ${filters.channels.includes('ONLINE') ? 'chip-active' : ''}`}
            title="Online: packs only, 35 DH delivery absorbed, 15% return provision"
          >
            <span className="h-2 w-2 rounded-full bg-wahj-ember" />
            Online
          </button>
        </div>

        {compact && (
          <button onClick={() => setExpanded((v) => !v)} className="chip">
            <IconFlame className="h-3 w-3" />
            Segments
            {activeFilterCount > 0 && <span className="rounded-full bg-wahj-gold/25 px-1 text-[9px] tnum">{activeFilterCount}</span>}
          </button>
        )}

        {activeFilterCount > 0 && (
          <button onClick={resetFilters} className="chip ml-auto border-transparent text-wahj-smoke hover:text-wahj-ink dark:hover:text-wahj-sand">
            <IconClose className="h-3 w-3" />
            Reset {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {showDetails && (
        <div className="animate-fade-in flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/[0.06] px-3 py-2.5 dark:border-white/[0.06] sm:px-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-wahj-smoke">ABC class</span>
            {CLASSES.map((c) => (
              <button
                key={c}
                onClick={() => toggleClass(c)}
                className={`chip px-2.5 py-1 ${filters.classes.includes(c) ? 'chip-active' : ''}`}
                title={CLASS_HINT[c]}
              >
                <span className="tnum">{c}</span>
                <span className="hidden text-[10px] opacity-70 sm:inline">· {filters.classes.includes(c) ? 'on' : 'off'}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-wahj-smoke">Audience</span>
            {(['men', 'women', 'unisex'] as Gender[]).map((g) => (
              <button
                key={g}
                onClick={() => toggleGender(g)}
                className={`chip px-2.5 py-1 capitalize ${filters.genders.includes(g) ? 'chip-active' : ''}`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="ml-auto hidden md:block">
            <RangeSummary />
          </div>
        </div>
      )}
    </div>
  )
}

export function SortableHeaderLegend() {
  return <span className="text-[10px] text-wahj-smoke">Click any column header to sort · exports follow the current view</span>
}

/** Re-export so screens can render class ordering deterministically. */
export const sortClasses = Object.keys(classRank) as ABCClass[]
