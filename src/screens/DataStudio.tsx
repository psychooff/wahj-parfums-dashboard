import { useCallback, useMemo, useRef, useState } from 'react'
import { useDashboard } from '../state/store'
import { useMedia } from '../state/media'
import { ChartCard, StatusPill } from '../components/ChartCard'
import { NoteCard } from '../components/NoteCard'
import { Thumb } from '../components/Thumb'
import { downloadCsv } from '../lib/csv'
import { optimizeImage, skuKeys } from '../lib/images'
import {
  batchesToCsv,
  importCsv,
  ordersToCsv,
  parseCsv,
  TEMPLATES,
  templateCsv,
  type ImportKind,
  type ImportPreview,
} from '../lib/importer'
import { formatDateTime } from '../lib/dates'
import { IconAlert, IconCheck, IconDownload, IconLayers, IconSpark } from '../components/icons'

function DropZone({
  onFiles,
  label,
  hint,
  accept = '.csv,text/csv',
  multiple = false,
}: {
  onFiles: (files: FileList) => void
  label: string
  hint: string
  accept?: string
  multiple?: boolean
}) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-all duration-300 ease-smooth ${
        over
          ? 'border-wahj-gold/70 bg-wahj-gold/[0.08] scale-[1.01]'
          : 'border-black/[0.12] bg-black/[0.015] hover:border-wahj-gold/50 hover:bg-wahj-gold/[0.04] dark:border-white/[0.12] dark:bg-white/[0.02]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => e.target.files?.length && onFiles(e.target.files)}
      />
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-wahj-gold/30 bg-wahj-gold/[0.1] text-wahj-gold">
        <IconDownload className="h-4 w-4 rotate-180" />
      </span>
      <span className="text-[13px] font-medium">{label}</span>
      <span className="max-w-[420px] text-[11px] leading-relaxed text-wahj-smoke">{hint}</span>
    </div>
  )
}

export function DataStudio() {
  const { dataset, settings, applyImport, resetToSampleData, dataSource, importLog, lastAction } = useDashboard()
  const customerName = (id: string) => dataset.customers.find((c) => c.id === id)?.name ?? id
  const customerPhone = (id: string) => dataset.customers.find((c) => c.id === id)?.phone ?? ''
  const media = useMedia()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [imageMessage, setImageMessage] = useState<string | null>(null)
  const [filterMissing, setFilterMissing] = useState(false)

  const importContext = useMemo(
    () => ({
      perfumes: dataset.perfumes,
      packs: dataset.packs,
      deliveryFee: settings.deliveryFee,
      returnProvisionRate: settings.returnProvisionRate,
      macerationDays: settings.macerationDays,
    }),
    [dataset.perfumes, dataset.packs, settings],
  )

  const handleCsv = useCallback(
    async (files: FileList) => {
      const file = files[0]
      if (!file) return
      setFileName(file.name)
      const text = await file.text()
      const result = importCsv(text, importContext)
      setPreview(result)
      setMessage(null)
    },
    [importContext],
  )

  const handleImages = useCallback(
    async (files: FileList) => {
      const optimized = await Promise.all(Array.from(files).map((f) => optimizeImage(f)))
      const { matched, unmatched } = await media.addFiles(optimized as File[])
      const parts: string[] = []
      if (matched) parts.push(`${matched} photo${matched > 1 ? 's' : ''} attached`)
      if (unmatched.length) parts.push(`no matching SKU for: ${unmatched.join(', ')}`)
      setImageMessage(parts.join(' · ') || 'Nothing imported — use .jpg, .png or .webp')
      window.setTimeout(() => setImageMessage(null), 6000)
    },
    [media],
  )

  const rowsWithoutImages = useMemo(
    () => dataset.perfumes.filter((p) => !media.images[p.id]),
    [dataset.perfumes, media.images],
  )
  const shown = filterMissing ? rowsWithoutImages : dataset.perfumes

  return (
    <div className="space-y-4">
      {/* ── Where do I put my data? ── */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-display text-lg">Bring your own data</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-wahj-smoke">
              Two ways in. <strong className="text-wahj-ink dark:text-wahj-sand">Option A — drop files right here</strong> (works instantly,
              stored in this browser). <strong className="text-wahj-ink dark:text-wahj-sand">Option B — commit them to the repo</strong> (permanent,
              visible to everyone who opens the dashboard): CSVs in <code className="rounded bg-black/[0.06] px-1 dark:bg-white/[0.08]">public/data/</code>,
              photos in <code className="rounded bg-black/[0.06] px-1 dark:bg-white/[0.08]">public/products/</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={dataSource === 'imported' ? 'ok' : 'info'} pulse>
              {dataSource === 'imported' ? 'Reading your data' : 'Reading sample data'}
            </StatusPill>
            <button
              className="btn px-3 py-1.5 text-xs"
              onClick={() => downloadCsv('wahj-orders-export.csv', parseCsv(ordersToCsv(dataset.orders, customerName, customerPhone)).rows)}
            >
              <IconDownload className="h-3.5 w-3.5" />
              Export current orders
            </button>
            {dataSource === 'imported' && (
              <button className="btn px-3 py-1.5 text-xs" onClick={resetToSampleData}>
                Back to sample data
              </button>
            )}
          </div>
        </div>

        {lastAction && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-pos/25 bg-pos/[0.08] px-3 py-2 text-[11.5px] text-pos">
            <IconCheck className="h-3.5 w-3.5" />
            {lastAction}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="1 · Import a CSV"
          subtitle="Orders, your production/maceration log, or your product catalogue — the file type is detected from the headers"
        >
          <DropZone
            onFiles={handleCsv}
            label="Drop your CSV here — or click to choose a file"
            hint="Excel/Sheets exports work as-is. Values in DH, dates as 2026-09-24 or 24/09/2026, channel as LOCAL/ONLINE (or boutique/colis), items as “2× Sauvage; 1× Khamrah”."
          />

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(TEMPLATES) as ImportKind[]).map((kind) => (
              <div key={kind} className="rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.07]">
                <p className="text-[12px] font-medium">{TEMPLATES[kind].label}</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-wahj-smoke">{TEMPLATES[kind].hint}</p>
                <button
                  className="btn mt-2 w-full px-2 py-1.5 text-[11px]"
                  onClick={() => downloadCsv(`${kind}-template.csv`, parseCsv(templateCsv(kind)).rows)}
                >
                  <IconDownload className="h-3 w-3" />
                  Download template
                </button>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-wahj-smoke">
            Expected columns — orders: <code>{TEMPLATES.orders.columns.join(', ')}</code> · production:{' '}
            <code>{TEMPLATES.production.columns.join(', ')}</code> · products: <code>{TEMPLATES.products.columns.join(', ')}</code>.
            Column names are matched loosely (French or English, any order), and unknown perfumes are created automatically.
          </p>

          {preview && (
            <div className="animate-fade-up mt-4 rounded-2xl border border-wahj-gold/25 bg-wahj-gold/[0.05] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12.5px] font-semibold">
                  Preview: {fileName} · detected as <span className="gold-text uppercase">{preview.kind}</span> · {preview.rowCount} rows
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="btn px-3 py-1.5 text-xs"
                    onClick={() => {
                      setPreview(null)
                      setFileName(null)
                    }}
                  >
                    Discard
                  </button>
                  <button
                    className="btn btn-primary px-3 py-1.5 text-xs"
                    disabled={preview.kind === 'unknown' || !preview.rowCount}
                    onClick={() => {
                      applyImport(preview)
                      setMessage({
                        tone: 'ok',
                        text:
                          preview.kind === 'orders'
                            ? `${preview.orders.length} orders are now live across every screen.`
                            : preview.kind === 'production'
                              ? `${preview.batches.length} batches loaded — check Stock & Maceration.`
                              : `${preview.perfumes.length} products loaded — unit costs recalculated from your recipes.`,
                      })
                      setPreview(null)
                    }}
                  >
                    Apply to dashboard
                  </button>
                </div>
              </div>

              <ul className="mt-2 space-y-1 text-[11.5px]">
                {preview.info.map((line) => (
                  <li key={line} className="flex gap-2 text-pos">
                    <IconCheck className="mt-[2px] h-3.5 w-3.5 shrink-0" />
                    {line}
                  </li>
                ))}
                {preview.warnings.slice(0, 8).map((line) => (
                  <li key={line} className="flex gap-2 text-warn">
                    <IconAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" />
                    {line}
                  </li>
                ))}
                {preview.warnings.length > 8 && (
                  <li className="text-wahj-smoke">…and {preview.warnings.length - 8} more warnings</li>
                )}
              </ul>

              {preview.kind === 'orders' && preview.orders.length > 0 && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-black/[0.06] bg-white/60 dark:border-white/[0.07] dark:bg-wahj-ink/60">
                  <table className="w-full min-w-[560px] text-[11px]">
                    <thead className="text-wahj-smoke">
                      <tr>
                        {['Order', 'Date', 'Channel', 'Items', 'Gross', 'Status'].map((h) => (
                          <th key={h} className="px-2.5 py-2 text-left font-semibold uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-soft">
                      {preview.orders.slice(0, 5).map((o) => (
                        <tr key={o.id}>
                          <td className="px-2.5 py-1.5 tnum">{o.code}</td>
                          <td className="px-2.5 py-1.5 tnum text-wahj-smoke">{o.createdAt.slice(0, 10)}</td>
                          <td className="px-2.5 py-1.5">{o.channel}</td>
                          <td className="max-w-[220px] truncate px-2.5 py-1.5 text-wahj-smoke">
                            {o.items.map((it) => `${it.quantity}× ${it.name}`).join(', ')}
                          </td>
                          <td className="px-2.5 py-1.5 tnum">{o.grossRevenue} DH</td>
                          <td className="px-2.5 py-1.5">{o.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {message && (
            <p
              className={`mt-3 rounded-xl border px-3 py-2 text-[11.5px] ${
                message.tone === 'ok' ? 'border-pos/25 bg-pos/[0.08] text-pos' : 'border-neg/25 bg-neg/[0.08] text-neg'
              }`}
            >
              {message.text}
            </p>
          )}
        </ChartCard>

        <div className="space-y-3">
          <ChartCard title="2 · Quick exports" subtitle="Same format the importer reads — round-trips safely">
            <div className="space-y-2">
              <button
                className="btn w-full justify-start px-3 py-2 text-xs"
                onClick={() => downloadCsv('wahj-orders.csv', parseCsv(ordersToCsv(dataset.orders)).rows)}
              >
                <IconDownload className="h-3.5 w-3.5" />
                Orders ({(dataset.orders.length / 1000).toFixed(1)}k rows)
              </button>
              <button
                className="btn w-full justify-start px-3 py-2 text-xs"
                onClick={() =>
                  downloadCsv(
                    'wahj-production.csv',
                    parseCsv(batchesToCsv(dataset.batches, (id) => dataset.perfumes.find((p) => p.id === id)?.name ?? id)).rows,
                  )
                }
              >
                <IconDownload className="h-3.5 w-3.5" />
                Production log ({dataset.batches.length} batches)
              </button>
              <button
                className="btn w-full justify-start px-3 py-2 text-xs"
                onClick={() =>
                  downloadCsv(
                    'wahj-catalogue.csv',
                    dataset.perfumes.map((p) => ({
                      name: p.name,
                      brand: p.brand,
                      gender: p.gender,
                      abc_class: p.abcClass,
                      oil_cost: p.recipe.oilCost,
                      bottles_per_batch: p.recipe.bottlesPerBatch,
                      local_single_price: p.localSinglePrice,
                      local_duo_price: p.localDuoPrice,
                    })),
                  )
                }
              >
                <IconDownload className="h-3.5 w-3.5" />
                Catalogue ({dataset.perfumes.length} SKUs)
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-wahj-smoke">
              Export → edit in Excel or Google Sheets → re-import. Nothing is locked inside this tool.
            </p>
          </ChartCard>

          <ChartCard title="3 · Where files live in the repo" subtitle="For permanent data instead of browser-only uploads">
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-wahj-smoke">
              <li className="rounded-xl border border-black/[0.06] p-2.5 dark:border-white/[0.07]">
                <code className="text-wahj-ink dark:text-wahj-sand">public/data/orders.csv</code>
                <span className="block text-[10.5px]">Orders — drop your export here, then run <code>npm run data:import</code> (or import it above).</span>
              </li>
              <li className="rounded-xl border border-black/[0.06] p-2.5 dark:border-white/[0.07]">
                <code className="text-wahj-ink dark:text-wahj-sand">public/data/production.csv</code>
                <span className="block text-[10.5px]">Batch/maceration log.</span>
              </li>
              <li className="rounded-xl border border-black/[0.06] p-2.5 dark:border-white/[0.07]">
                <code className="text-wahj-ink dark:text-wahj-sand">public/data/catalogue.csv</code>
                <span className="block text-[10.5px]">Your own perfume list and recipes.</span>
              </li>
              <li className="rounded-xl border border-black/[0.06] p-2.5 dark:border-white/[0.07]">
                <code className="text-wahj-ink dark:text-wahj-sand">public/products/&lt;sku&gt;.jpg</code>
                <span className="block text-[10.5px]">
                  Photos named after the SKU — <code>sauvage.jpg</code>, <code>khamrah.jpg</code>, <code>dior-bleu-de-chanel.jpg</code>. Then run{' '}
                  <code>npm run media:manifest</code>.
                </span>
              </li>
            </ul>
          </ChartCard>
        </div>
      </div>

      {/* ── Photos ── */}
      <ChartCard
        title="Product photos"
        subtitle={`${Object.keys(media.images).length} of ${dataset.perfumes.length} SKUs have a picture — drop files named after the perfume (sauvage.jpg) and they attach automatically`}
        actions={
          <div className="flex items-center gap-2">
            <button className={`chip ${filterMissing ? 'chip-active' : ''}`} onClick={() => setFilterMissing((v) => !v)}>
              Missing only ({rowsWithoutImages.length})
            </button>
            <button
              className="chip"
              onClick={async () => {
                await media.clearUploads()
                setImageMessage('Browser uploads cleared — repo photos kept')
              }}
            >
              Clear uploads
            </button>
          </div>
        }
      >
        <DropZone
          onFiles={handleImages}
          multiple
          accept="image/*"
          label="Drop product photos here"
          hint="Any number of files at once. Name them after the perfume (sauvage.jpg, khamrah.png, dior-bleu-de-chanel.webp) so they match automatically, or use the upload button on a single card below. Photos are resized to 720px and stored in this browser."
        />

        {imageMessage && <p className="animate-fade-in mt-3 rounded-xl border border-pos/25 bg-pos/[0.08] px-3 py-2 text-[11.5px] text-pos">{imageMessage}</p>}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((perfume) => (
            <div key={perfume.id} className="rounded-2xl border border-black/[0.06] p-3 dark:border-white/[0.07]">
              <div className="flex items-start gap-3">
                <Thumb perfume={perfume} size={56} glow={Boolean(media.images[perfume.id])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{perfume.name}</p>
                  <p className="truncate text-[10.5px] text-wahj-smoke">
                    {perfume.brand} · Class {perfume.abcClass}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-wahj-smoke">
                    filename: <code>{skuKeys(perfume)[1]}.jpg</code>
                  </p>
                </div>
                {media.source[perfume.id] && (
                  <StatusPill tone={media.source[perfume.id] === 'upload' ? 'info' : 'ok'}>
                    {media.source[perfume.id] === 'upload' ? 'upload' : 'repo'}
                  </StatusPill>
                )}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <label className="btn flex-1 cursor-pointer justify-center px-2 py-1.5 text-[11px]">
                  {media.images[perfume.id] ? 'Replace' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      if (!e.target.files?.length) return
                      const optimized = await optimizeImage(e.target.files[0])
                      const res = await media.addFiles([optimized], perfume.id)
                      setImageMessage(res.matched ? `Photo attached to ${perfume.name}` : 'Could not read that file')
                    }}
                  />
                </label>
                {media.images[perfume.id] && media.source[perfume.id] === 'upload' && (
                  <button className="btn px-2 py-1.5 text-[11px]" onClick={() => media.removeImage(perfume.id)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* ── Import history ── */}
      {importLog.length > 0 && (
        <ChartCard title="Import history" subtitle="What has been loaded in this session">
          <ul className="space-y-2">
            {importLog.map((entry) => (
              <li key={entry.at} className="rounded-xl border border-black/[0.06] p-3 text-[11.5px] dark:border-white/[0.07]">
                <p className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={entry.kind === 'unknown' ? 'bad' : 'ok'}>{entry.kind}</StatusPill>
                  <span className="tnum">{entry.rows} rows</span>
                  <span className="text-wahj-smoke">{formatDateTime(entry.at)}</span>
                </p>
                <ul className="mt-1.5 space-y-0.5 text-wahj-smoke">
                  {entry.info.map((i) => (
                    <li key={i}>· {i}</li>
                  ))}
                  {entry.warnings.slice(0, 4).map((w) => (
                    <li key={w} className="text-warn">
                      ! {w}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      <NoteCard
        title="How to migrate your existing v1 spreadsheet"
        items={[
          'Open your current sheet, add a header row with the template columns (download them above), then export as CSV — column order does not matter.',
          'Dates: 2026-09-24 and 24/09/2026 both work. Amounts: “1 234,50 DH” and “1,234.50” both parse.',
          'Channel matters: LOCAL rows get no delivery cost and no return provision; ONLINE rows get 35 DH delivery and a 15% return provision, exactly as in your rulebook.',
          'Items can be a single column (“2× Sauvage; 1× Khamrah”) or one row per item — group by the order code either way.',
          'Packs are matched by name: “1× Pack Parfait — Elle” is recognised and consumes its 5 component bottles from stock.',
          'Photos: upload here for an instant preview. For the permanent version, commit them to public/products/ so they travel with the code.',
        ]}
        footer={
          <span className="flex items-center gap-2">
            <IconSpark className="h-3.5 w-3.5 text-wahj-gold" />
            When you move to the real backend (Supabase + Prisma), only src/lib/importer.ts and the store need to change — every chart already reads
            the same types.
          </span>
        }
      />

      <div className="flex items-center gap-2 px-1 text-[11px] text-wahj-smoke">
        <IconLayers className="h-3.5 w-3.5" />
        Currently loaded: {dataset.orders.length.toLocaleString('en-US')} orders · {dataset.perfumes.length} SKUs · {dataset.batches.length} batches ·
        {' '}{dataset.customers.length} customers · {Object.keys(media.images).length} photos
      </div>
    </div>
  )
}
