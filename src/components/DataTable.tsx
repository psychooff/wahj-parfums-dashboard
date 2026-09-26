import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { downloadCsv } from '../lib/csv'
import { IconChevron, IconDownload, IconSearch } from './icons'

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  sortValue?: (row: T) => number | string
  render: (row: T) => ReactNode
  /** Value written to the CSV export (defaults to sortValue). */
  csv?: (row: T) => string | number
  width?: string
  cellClassName?: string
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  searchable?: boolean
  searchPlaceholder?: string
  searchText?: (row: T) => string
  toolbar?: ReactNode
  pageSize?: number
  pageSizeOptions?: number[]
  csvName?: string
  renderExpanded?: (row: T) => ReactNode
  emptyMessage?: string
  maxHeight?: string
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  initialSort,
  searchable = true,
  searchPlaceholder = 'Search…',
  searchText,
  toolbar,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  csvName,
  renderExpanded,
  emptyMessage = 'No rows match the current filters.',
  maxHeight,
  onRowClick,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!query.trim() || !searchText) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((r) => searchText(r).toLowerCase().includes(q))
  }, [rows, query, searchText])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return filtered
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [filtered, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, totalPages - 1)
  const pageRows = useMemo(() => sorted.slice(current * pageSize, current * pageSize + pageSize), [sorted, current, pageSize])

  const toggleSort = (key: string) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'desc' }
      if (s.dir === 'desc') return { key, dir: 'asc' }
      return null
    })
    setPage(0)
  }

  const exportCsv = () => {
    const data = sorted.map((row) => {
      const record: Record<string, string | number> = {}
      for (const col of columns) {
        const get = col.csv ?? col.sortValue
        record[col.header] = get ? get(row) : ''
      }
      return record
    })
    downloadCsv(csvName ?? 'wahj-export.csv', data)
  }

  const alignClass = (a?: Column<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')

  return (
    <div className="flex flex-col">
      {(searchable || toolbar || csvName) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-3 py-3 dark:border-white/[0.06] sm:px-4">
          {searchable && searchText && (
            <label className="relative flex-1 sm:max-w-xs">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wahj-smoke" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
                placeholder={searchPlaceholder}
                className="input pl-8"
              />
            </label>
          )}
          {toolbar}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-wahj-smoke tnum sm:inline">
              {sorted.length.toLocaleString('en-US')} rows
            </span>
            {csvName && (
              <button onClick={exportCsv} className="btn px-2.5 py-1.5 text-xs" title="Export the current view to CSV">
                <IconDownload className="h-3.5 w-3.5" />
                CSV
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-wahj-paper/95 backdrop-blur dark:bg-wahj-ink/95">
            <tr>
              {renderExpanded && <th className="w-8 pl-3" />}
              {columns.map((col) => {
                const active = sort?.key === col.key
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={`whitespace-nowrap border-b border-black/[0.07] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-wahj-smoke dark:border-white/[0.07] ${alignClass(col.align)}`}
                  >
                    {col.sortable !== false && col.sortValue ? (
                      <button
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 transition-colors duration-200 hover:text-wahj-gold ${
                          active ? 'text-wahj-gold' : ''
                        } ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                      >
                        {col.header}
                        <IconChevron
                          className={`h-3 w-3 transition-transform duration-200 ${active ? 'opacity-100' : 'opacity-25'} ${
                            active && sort?.dir === 'asc' ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-soft">
            {pageRows.map((row, i) => {
              const key = rowKey(row)
              const isOpen = expanded === key
              return (
                <Fragment key={key}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`row-hover animate-fade-in ${onRowClick ? 'cursor-pointer' : ''}`}
                    style={{ animationDelay: `${Math.min(i * 14, 180)}ms` }}
                  >
                    {renderExpanded && (
                      <td className="pl-2 align-middle">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpanded(isOpen ? null : key)
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-wahj-smoke transition-colors hover:bg-black/[0.05] hover:text-wahj-gold dark:hover:bg-white/[0.07]"
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                        >
                          <IconChevron className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`whitespace-nowrap border-b border-black/[0.04] px-3 py-2.5 align-middle dark:border-white/[0.04] ${alignClass(col.align)} ${col.cellClassName ?? ''}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && renderExpanded && (
                    <tr className="animate-fade-in bg-black/[0.015] dark:bg-white/[0.02]">
                      <td colSpan={columns.length + 1} className="px-4 py-4">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!pageRows.length && (
              <tr>
                <td colSpan={columns.length + (renderExpanded ? 1 : 0)} className="px-4 py-10 text-center text-sm text-wahj-smoke">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2 text-[11px] text-wahj-smoke">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(0)
            }}
            className="rounded-lg border border-black/[0.08] bg-transparent px-2 py-1 text-[11px] dark:border-white/[0.1] dark:bg-wahj-ink"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setPage(0)} disabled={current === 0} className="btn px-2 py-1 text-xs disabled:opacity-40">
            «
          </button>
          <button onClick={() => setPage(current - 1)} disabled={current === 0} className="btn px-2 py-1 text-xs disabled:opacity-40">
            Prev
          </button>
          <span className="px-2 text-[11px] text-wahj-smoke tnum">
            {current + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(current + 1)}
            disabled={current >= totalPages - 1}
            className="btn px-2 py-1 text-xs disabled:opacity-40"
          >
            Next
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={current >= totalPages - 1}
            className="btn px-2 py-1 text-xs disabled:opacity-40"
          >
            »
          </button>
        </div>
      </div>
    </div>
  )
}
