import { useMemo, useState } from 'react'
import { useDashboard } from '../state/store'
import { FilterBar } from '../components/FilterBar'
import { ChartCard, StatusPill } from '../components/ChartCard'
import { KpiCard } from '../components/KpiCard'
import { DataTable, type Column } from '../components/DataTable'
import { NoteCard } from '../components/NoteCard'
import { StockMixChart } from '../charts/ProductCharts'
import { formatDH, formatDateLong, dayKey, parseDay, daysBetween, startOfDay } from '../lib/dates'
import type { ProductionBatch, StockRow } from '../lib/types'
import { IconAlert, IconBox, IconCheck, IconClock, IconDroplet, IconSpark } from '../components/icons'

const today = startOfDay(new Date())

function Countdown({ readyInDays, status }: { readyInDays: number; status: ProductionBatch['status'] }) {
  if (status === 'READY') return <span className="badge border border-warn/30 bg-warn/[0.14] text-warn"><IconCheck className="h-3 w-3" />Ready — confirm now</span>
  if (readyInDays <= 0) return <span className="badge border border-pos/30 bg-pos/[0.14] text-pos">Ready today</span>
  if (readyInDays <= 3) return <span className="badge border border-warn/30 bg-warn/[0.14] text-warn">Ready in {readyInDays} days</span>
  return (
    <span className="badge border border-black/[0.08] bg-black/[0.04] text-wahj-smoke dark:border-white/[0.08] dark:bg-white/[0.05]">
      <IconClock className="h-3 w-3" />
      Ready in {readyInDays} days
    </span>
  )
}

function NewBatchForm() {
  const { dataset, createBatch, settings } = useDashboard()
  const [perfumeId, setPerfumeId] = useState(dataset.perfumes[0]?.id ?? '')
  const [bottleCount, setBottleCount] = useState(16)
  const [productionDate, setProductionDate] = useState(dayKey(new Date()))
  const [flash, setFlash] = useState<string | null>(null)

  const perfume = dataset.perfumes.find((p) => p.id === perfumeId)
  const readyDate = dayKey(new Date(parseDay(productionDate).getTime() + settings.macerationDays * 86400000))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        createBatch(perfumeId, bottleCount, productionDate)
        setFlash(`${perfume?.name} × ${bottleCount} bottles started — confirmed sellable on ${formatDateLong(readyDate)}`)
        window.setTimeout(() => setFlash(null), 5000)
      }}
    >
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-wahj-smoke">Perfume</label>
        <select value={perfumeId} onChange={(e) => setPerfumeId(e.target.value)} className="input">
          {dataset.perfumes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.brand} (Class {p.abcClass})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-wahj-smoke">Bottles</label>
          <input
            type="number"
            min={1}
            max={recipe_max(perfume?.recipe.bottlesPerBatch ?? 16)}
            value={bottleCount}
            onChange={(e) => setBottleCount(Math.max(1, Math.min(recipe_max(perfume?.recipe.bottlesPerBatch ?? 16), Number(e.target.value) || 1)))}
            className="input tnum"
          />
          <p className="mt-1 text-[10px] text-wahj-smoke tnum">Standard batch = {perfume?.recipe.bottlesPerBatch ?? 16} bottles (500ml)</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-wahj-smoke">Production date</label>
          <input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} className="input tnum" />
          <p className="mt-1 text-[10px] text-wahj-smoke">Defaults to today</p>
        </div>
      </div>

      <div className="rounded-xl border border-wahj-gold/25 bg-wahj-gold/[0.06] p-3 text-[11.5px]">
        <p className="flex items-center gap-2 font-semibold text-wahj-ink dark:text-wahj-sand">
          <IconSpark className="h-3.5 w-3.5 text-wahj-gold" />
          Maceration ends {settings.macerationDays} days after production
        </p>
        <p className="mt-1 text-wahj-smoke tnum">
          Sellable from {formatDateLong(readyDate)} · batch cost{' '}
          {formatDH(Math.round((perfume?.unitCost30ml ?? 0) * bottleCount))} ·{' '}
          {formatDH(perfume?.unitCost30ml ?? 0, { decimals: 2 })}/bottle
        </p>
      </div>

      <button type="submit" className="btn btn-primary w-full py-2 text-[13px] font-semibold">
        Start batch — status MACERATING
      </button>
      {flash && (
        <p className="animate-fade-in rounded-lg border border-pos/25 bg-pos/[0.08] px-3 py-2 text-[11px] text-pos">{flash}</p>
      )}
    </form>
  )
}

const recipe_max = (n: number) => Math.max(1, Math.round(n * 2))

export function Stock() {
  const { stock, stockSummary, openAlerts, theme, dataset, confirmBatch, lastAction, batches, filters } = useDashboard()
  const [statusFilter, setStatusFilter] = useState<'all' | 'attention' | 'ok'>('all')

  const cooking = useMemo(
    () =>
      batches
        .filter((b) => {
          const p = dataset.perfumes.find((x) => x.id === b.perfumeId)
          return (b.status === 'MACERATING' || b.status === 'READY') && b.bottlesRemaining > 0 && p && filters.classes.includes(p.abcClass)
        })
        .sort((a, b) => a.readyDate.localeCompare(b.readyDate)),
    [batches, dataset.perfumes, filters.classes],
  )

  const readyToConfirm = cooking.filter((b) => b.status === 'READY' || daysBetween(today, parseDay(b.readyDate)) <= 0)

  const rows = useMemo(() => {
    if (statusFilter === 'all') return stock
    if (statusFilter === 'attention') return stock.filter((s) => s.reorderStatus !== 'ok')
    return stock.filter((s) => s.reorderStatus === 'ok')
  }, [stock, statusFilter])

  const columns: Column<StockRow>[] = [
    {
      key: 'perfume',
      header: 'Perfume',
      sortValue: (r) => r.perfume.name,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.perfume.name}</span>
          <span className="text-[10.5px] text-wahj-smoke">
            {r.perfume.brand} · {r.perfume.gender}
          </span>
        </span>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      sortValue: (r) => r.perfume.abcClass,
      render: (r) => (
        <StatusPill tone={r.perfume.abcClass === 'A' ? 'info' : 'neutral'}>
          {r.perfume.abcClass} · trigger {r.trigger}
        </StatusPill>
      ),
    },
    {
      key: 'sellable',
      header: 'Sellable',
      align: 'right',
      sortValue: (r) => r.sellable,
      render: (r) => <span className={`font-display text-base tnum ${r.sellable === 0 ? 'text-neg' : ''}`}>{r.sellable}</span>,
    },
    {
      key: 'macerating',
      header: 'Macerating',
      align: 'right',
      sortValue: (r) => r.macerating,
      render: (r) => (
        <span className="tnum text-wahj-smoke">
          {r.macerating}
          {r.nextReadyInDays !== null && (
            <span className="ml-1 text-[10px]">{r.nextReadyInDays <= 0 ? '(ready)' : `(+${r.nextReadyInDays}d)`}</span>
          )}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (r) => r.total,
      render: (r) => <span className="tnum text-wahj-smoke">{r.total}</span>,
    },
    {
      key: 'value',
      header: 'Stock value',
      align: 'right',
      sortValue: (r) => r.sellable * r.perfume.unitCost30ml,
      render: (r) => <span className="tnum">{formatDH(Math.round(r.sellable * r.perfume.unitCost30ml))}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => (r.reorderStatus === 'urgent' ? 0 : r.reorderStatus === 'reorder' ? 1 : 2),
      render: (r) => (
        <StatusPill tone={r.reorderStatus === 'urgent' ? 'bad' : r.reorderStatus === 'reorder' ? 'warn' : 'ok'} pulse={r.reorderStatus === 'urgent'}>
          {r.reorderStatus === 'urgent' ? 'Urgent — reorder now' : r.reorderStatus === 'reorder' ? 'Reorder soon' : 'OK'}
        </StatusPill>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <FilterBar />

      {lastAction && (
        <div className="animate-fade-in flex items-center gap-2 rounded-xl border border-pos/25 bg-pos/[0.08] px-3 py-2 text-[12px] text-pos">
          <IconCheck className="h-4 w-4 shrink-0" />
          {lastAction}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sellable now"
          value={stockSummary.sellableBottles}
          format={(n) => `${Math.round(n)} bottles`}
          accent="gold"
          icon={<IconBox className="h-3.5 w-3.5" />}
          hint={<span className="tnum">The only stock customers can buy today</span>}
        />
        <KpiCard
          label="Macerating"
          value={stockSummary.maceratingBottles}
          format={(n) => `${Math.round(n)} bottles`}
          accent="ember"
          icon={<IconDroplet className="h-3.5 w-3.5" />}
          hint={<span className="tnum">{cooking.length} batches still cooking — invisible to customers</span>}
        />
        <KpiCard
          label="Stock value (cost)"
          value={stockSummary.value}
          format={(n) => formatDH(Math.round(n))}
          accent="sage"
          icon={<IconSpark className="h-3.5 w-3.5" />}
          hint={<span className="tnum">Cash sitting on the shelf at cost price</span>}
        />
        <KpiCard
          label="Reorder alerts"
          value={openAlerts.length}
          format={(n) => `${Math.round(n)} SKUs`}
          accent={openAlerts.some((a) => a.reorderStatus === 'urgent') ? 'ember' : 'neutral'}
          icon={<IconAlert className="h-3.5 w-3.5" />}
          hint={<span className="tnum">{openAlerts.filter((a) => a.reorderStatus === 'urgent').length} urgent · generated by the ABC triggers</span>}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Active maceration"
          subtitle="Sorted by ready date — nothing here is sellable yet"
          footer={
            <span>
              Macerating dates are calculated as production date + 14 days. A batch only becomes sellable when you confirm it
              physically — that is what keeps sellable stock honest.
            </span>
          }
          bodyClassName="!px-0 !pb-0"
        >
          <ul className="divide-soft">
            {cooking.slice(0, 8).map((b, i) => {
              const perfume = dataset.perfumes.find((p) => p.id === b.perfumeId)
              const readyInDays = daysBetween(today, parseDay(b.readyDate))
              const canConfirm = b.status === 'READY' || readyInDays <= 0
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 animate-fade-up sm:px-5"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{perfume?.name}</span>
                      <span className="text-[10.5px] text-wahj-smoke tnum">{b.code}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-wahj-smoke tnum">
                      produced {b.productionDate} · {b.bottlesRemaining} bottles · ready {b.readyDate} · Class {perfume?.abcClass}
                    </span>
                  </span>
                  <Countdown readyInDays={readyInDays} status={b.status} />
                  <button
                    onClick={() => confirmBatch(b.id)}
                    disabled={!canConfirm}
                    className={`btn px-3 py-1.5 text-[11px] ${canConfirm ? 'border-wahj-gold/60 text-wahj-gold hover:bg-wahj-gold/[0.12]' : 'opacity-40'}`}
                    title={canConfirm ? 'Move this batch into sellable stock' : `Available on ${b.readyDate}`}
                  >
                    Move to stock
                  </button>
                </li>
              )
            })}
            {!cooking.length && <li className="px-4 py-8 text-center text-sm text-wahj-smoke">Nothing is macerating right now — every SKU is confirmed stock.</li>}
          </ul>
        </ChartCard>

        <div className="space-y-3">
          <ChartCard
            title="+ New production batch"
            subtitle="1 batch = 500ml = 16 × 30ml bottles, 205 DH of materials"
          >
            <NewBatchForm />
          </ChartCard>

          {readyToConfirm.length > 0 && (
            <ChartCard
              title="Confirm ready batches"
              subtitle={`${readyToConfirm.length} batch${readyToConfirm.length > 1 ? 'es are' : ' is'} past their maceration date`}
            >
              <ul className="space-y-2">
                {readyToConfirm.map((b) => {
                  const perfume = dataset.perfumes.find((p) => p.id === b.perfumeId)
                  return (
                    <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl border border-warn/25 bg-warn/[0.06] px-3 py-2">
                      <span className="text-[11.5px]">
                        <span className="block font-medium">{perfume?.name}</span>
                        <span className="text-wahj-smoke tnum">
                          {b.bottlesRemaining} bottles · {b.code}
                        </span>
                      </span>
                      <button onClick={() => confirmBatch(b.id)} className="btn border-warn/40 px-2.5 py-1 text-[11px] text-warn hover:bg-warn/[0.12]">
                        Confirm
                      </button>
                    </li>
                  )
                })}
              </ul>
            </ChartCard>
          )}
        </div>
      </div>

      <ChartCard
        title="Sellable vs. macerating"
        subtitle="The gap is the whole point of the 14-day rule — those bottles exist but cannot be sold"
        footer={<span>Bar length = total bottles in the system for that SKU. Gold is sellable, ember is still macerating.</span>}
      >
        <StockMixChart rows={stock} mode={theme} limit={12} />
      </ChartCard>

      <ChartCard
        title="Stock & reorder table"
        subtitle="Click a row to expand its production batches · colours come straight from the ABC triggers"
        bodyClassName="!px-0 !pb-0"
        actions={
          <div className="flex items-center gap-1.5">
            {(['all', 'attention', 'ok'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`chip px-2.5 py-1 text-[11px] capitalize ${statusFilter === f ? 'chip-active' : ''}`}
              >
                {f === 'attention' ? `needs reorder (${openAlerts.length})` : f}
              </button>
            ))}
          </div>
        }
      >
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.perfume.id}
          initialSort={{ key: 'sellable', dir: 'asc' }}
          searchPlaceholder="Search perfume or brand…"
          searchText={(r) => `${r.perfume.name} ${r.perfume.brand} ${r.perfume.abcClass}`}
          csvName="wahj-stock.csv"
          pageSize={12}
          renderExpanded={(r) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {r.batches.slice(0, 6).map((b) => (
                <div key={b.id} className="rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2 text-[11px] dark:border-white/[0.07] dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium tnum">{b.code}</span>
                    <StatusPill tone={b.status === 'IN_STOCK' ? 'ok' : b.status === 'READY' ? 'warn' : b.status === 'DEPLETED' ? 'neutral' : 'info'}>
                      {b.status.toLowerCase().replace('_', ' ')}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-wahj-smoke tnum">
                    {b.productionDate} → {b.readyDate}
                  </p>
                  <p className="text-wahj-smoke tnum">
                    {b.bottlesRemaining}/{b.bottleCount} left · {formatDH(Math.round(b.costPerBatch))}
                  </p>
                </div>
              ))}
              {!r.batches.length && <p className="text-xs text-wahj-smoke">No batches recorded for this SKU in this window.</p>}
            </div>
          )}
        />
      </ChartCard>

      <NoteCard
        title="How this screen replaces your paper trackers"
        items={[
          'Sellable stock = SUM(bottles_remaining) where status = IN_STOCK. Only this number feeds reorder alerts and the storefront.',
          'Macerating stock (MACERATING + READY) is tracked but excluded from every customer-facing count — sellable ≠ total.',
          'The reorder badge compares sellable stock to the class trigger (A=8, B=5, C=3) which you can change on the Business Rules screen.',
          'Confirming a batch here moves it into sellable stock immediately and updates the KPIs on every other screen.',
        ]}
      />
    </div>
  )
}
