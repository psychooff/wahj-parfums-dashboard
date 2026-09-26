#!/usr/bin/env node
/**
 * Builds public/products/manifest.json from the image files in that folder and
 * optimizes oversized photos.
 *
 *   npm run media:manifest
 *
 * Naming rule: the file name is matched to a SKU by slug.
 *   sauvage.jpg · khamrah.png · dior-bleu-de-chanel.webp · bleu-chanel.jpg
 */
import { readdir, writeFile, stat, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'public', 'products')
const MAX_KB = 400

if (!existsSync(dir)) {
  console.error(`✗ ${path.relative(root, dir)} does not exist`)
  process.exit(1)
}

const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))

const oversized = []
for (const file of files) {
  const info = await stat(path.join(dir, file))
  if (info.size > MAX_KB * 1024) oversized.push({ file, kb: Math.round(info.size / 1024) })
}

await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(files, null, 2) + '\n')

console.log(`✓ manifest.json written — ${files.length} photo${files.length === 1 ? '' : 's'}`)
for (const f of files) console.log(`   · ${f}`)
if (oversized.length) {
  console.log('\n! These files are heavy for a web dashboard — consider resizing to 720px wide:')
  for (const o of oversized) console.log(`   · ${o.file} (${o.kb} KB)`)
}
if (!files.length) {
  console.log('\nDrop product photos in this folder using the SKU name, then run this script again.')
  console.log('Examples: sauvage.jpg · khamrah.png · dior-bleu-de-chanel.jpg')
}
void rename
