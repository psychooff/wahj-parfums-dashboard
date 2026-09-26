/**
 * Writes filled example CSVs into public/data-examples/ — real-looking files in
 * the exact shape the importer reads, so the format is never a guess.
 *
 *   npm run data:examples
 *
 * They are NOT auto-loaded (that folder is not watched). Copy a file into
 * public/data/ with the right name to make the dashboard read it.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildDataset } from '../src/data/generate'
import { batchesToCsv, ordersToCsv, parseCsv, templateCsv } from '../src/lib/importer'

const outDir = path.resolve('public', 'data-examples')
await mkdir(outDir, { recursive: true })

const ds = buildDataset()
const nameOf = (id: string) => ds.customers.find((c) => c.id === id)?.name ?? id
const phoneOf = (id: string) => ds.customers.find((c) => c.id === id)?.phone ?? ''

// Orders: the last 120 days, so the file stays small but stays realistic.
const cutoff = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)
const recent = ds.orders.filter((o) => o.createdAt.slice(0, 10) >= cutoff)

const files: Array<[string, string, string]> = [
  ['orders.example.csv', ordersToCsv(recent, nameOf, phoneOf), `${recent.length} orders from the last 120 days`],
  ['production.example.csv', batchesToCsv(ds.batches, (id) => ds.perfumes.find((p) => p.id === id)?.name ?? id), `${ds.batches.length} production batches`],
  [
    'catalogue.example.csv',
    [
      'name,brand,gender,abc_class,oil_cost,bottles_per_batch,local_single_price,local_duo_price',
      ...ds.perfumes.map((p) =>
        [p.name, p.brand, p.gender, p.abcClass, p.recipe.oilCost, p.recipe.bottlesPerBatch, p.localSinglePrice, p.localDuoPrice].join(','),
      ),
    ].join('\n'),
    `${ds.perfumes.length} SKUs`,
  ],
]

for (const [name, content, note] of files) {
  await writeFile(path.join(outDir, name), content + '\n')
  const { rows } = parseCsv(content)
  console.log(`✓ ${name} — ${note} (${rows.length} data rows, ${Math.round(content.length / 1024)} KB)`)
}

// Empty starting points for the founder's own numbers.
for (const kind of ['orders', 'production', 'products'] as const) {
  const name = `${kind}.template.csv`
  await writeFile(path.join(outDir, name), templateCsv(kind) + '\n')
  console.log(`✓ ${name} — header + 2 example rows, ready to fill in`)
}

console.log(`\nWritten to ${path.relative(process.cwd(), outDir)}/`)
console.log('To make the dashboard read one: copy it to public/data/ (same file name) and reload.')
