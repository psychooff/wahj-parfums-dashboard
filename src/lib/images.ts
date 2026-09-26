/**
 * Product photos come from two places, in this priority order:
 *
 *   1. Uploads made in the dashboard (drag & drop on the Data & Photos screen).
 *      Stored in the browser's IndexedDB, so they survive reloads on that machine.
 *   2. Files committed to the repo in `public/products/` and listed in
 *      `public/products/manifest.json` (regenerate with `npm run media:manifest`).
 *      These ship with the app and are visible to everyone.
 *
 * Filenames are matched to a SKU by slug: `sauvage.jpg`, `khamrah.png`,
 * `dior-bleu-de-chanel.webp` and `bleu-chanel.jpg` all resolve.
 */
import { useEffect, useState } from 'react'
import type { Perfume } from './types'

const DB_NAME = 'wahj-media'
const STORE = 'product-images'
const VERSION = 1

export interface ImageMap {
  [perfumeId: string]: string
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** All the keys a file could use to identify a SKU. */
export function skuKeys(perfume: Perfume): string[] {
  const keys = [perfume.id, slug(perfume.name), slug(`${perfume.brand}-${perfume.name}`), slug(`${perfume.name}-${perfume.brand}`)]
  return [...new Set(keys.filter(Boolean))]
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

async function idbAll(): Promise<ImageMap> {
  const db = await openDb()
  if (!db) return {}
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const out: ImageMap = {}
    const cursorRequest = store.openCursor()
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (cursor) {
        out[String(cursor.key)] = String(cursor.value)
        cursor.continue()
      } else resolve(out)
    }
    cursorRequest.onerror = () => resolve({})
  })
}

async function idbPut(key: string, value: string | null) {
  const db = await openDb()
  if (!db) return
  return new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    if (value === null) store.delete(key)
    else store.put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

async function loadManifest(): Promise<ImageMap> {
  try {
    const res = await fetch('products/manifest.json', { cache: 'no-cache' })
    if (!res.ok) return {}
    const files: string[] = await res.json()
    const map: ImageMap = {}
    for (const file of files) {
      const base = file.replace(/\.[a-z0-9]+$/i, '')
      map[slug(base)] = `products/${file}`
    }
    return map
  } catch {
    return {}
  }
}

export interface MediaState {
  /** perfumeId → image URL/data-url */
  images: ImageMap
  ready: boolean
  source: Record<string, 'upload' | 'repo'>
  addFiles: (files: FileList | File[], perfumeId?: string) => Promise<{ matched: number; unmatched: string[] }>
  removeImage: (perfumeId: string) => Promise<void>
  clearUploads: () => Promise<void>
}

export function useProductImages(perfumes: Perfume[]): MediaState {
  const [images, setImages] = useState<ImageMap>({})
  const [source, setSource] = useState<Record<string, 'upload' | 'repo'>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [repo, uploads] = await Promise.all([loadManifest(), idbAll()])
      if (cancelled) return
      const merged: ImageMap = {}
      const src: Record<string, 'upload' | 'repo'> = {}

      // repo files first, matched through each SKU's possible keys
      for (const p of perfumes) {
        for (const key of skuKeys(p)) {
          const hit = Object.entries(repo).find(([k]) => k === key)
          if (hit) {
            merged[p.id] = hit[1]
            src[p.id] = 'repo'
            break
          }
        }
      }
      // browser uploads win
      for (const [key, dataUrl] of Object.entries(uploads)) {
        merged[key] = dataUrl
        src[key] = 'upload'
      }
      setImages(merged)
      setSource(src)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [perfumes])

  const addFiles: MediaState['addFiles'] = async (files, perfumeId) => {
    const list = Array.from(files)
    const next: ImageMap = {}
    const unmatched: string[] = []
    let matched = 0

    for (const file of list) {
      if (!file.type.startsWith('image/')) {
        unmatched.push(`${file.name} (not an image)`)
        continue
      }
      const dataUrl = await readAsDataUrl(file)
      if (perfumeId && list.length === 1) {
        next[perfumeId] = dataUrl
        matched++
        continue
      }
      const base = slug(file.name.replace(/\.[a-z0-9]+$/i, ''))
      const hit = perfumes.find((p) => skuKeys(p).includes(base))
      if (hit) {
        next[hit.id] = dataUrl
        matched++
      } else {
        unmatched.push(file.name)
      }
    }

    for (const [key, value] of Object.entries(next)) await idbPut(key, value)
    setImages((prev) => ({ ...prev, ...next }))
    setSource((prev) => ({ ...prev, ...Object.fromEntries(Object.keys(next).map((k) => [k, 'upload' as const])) }))
    return { matched, unmatched }
  }

  const removeImage = async (perfumeId: string) => {
    await idbPut(perfumeId, null)
    setImages((prev) => {
      const next = { ...prev }
      delete next[perfumeId]
      return next
    })
    setSource((prev) => {
      const next = { ...prev }
      delete next[perfumeId]
      return next
    })
  }

  const clearUploads = async () => {
    for (const [key, kind] of Object.entries(source)) if (kind === 'upload') await idbPut(key, null)
    await reloadRepoOnly()
  }

  const reloadRepoOnly = async () => {
    const repo = await loadManifest()
    const merged: ImageMap = {}
    for (const p of perfumes) {
      for (const key of skuKeys(p)) {
        const hit = Object.entries(repo).find(([k]) => k === key)
        if (hit) {
          merged[p.id] = hit[1]
          break
        }
      }
    }
    setImages(merged)
    setSource(Object.fromEntries(Object.keys(merged).map((k) => [k, 'repo' as const])))
  }

  return { images, ready, source, addFiles, removeImage, clearUploads }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

/** Downscales big camera photos so IndexedDB stays small. */
export async function optimizeImage(file: File, maxSize = 720): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 250_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}
