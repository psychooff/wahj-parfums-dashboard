/**
 * Storage that never throws.
 *
 * The dashboard can be opened inside a sandboxed iframe (a preview embed, an
 * LMS, a strict `sandbox` attribute) where ANY access to localStorage or
 * indexedDB raises a SecurityError. Unguarded access there blanks the entire
 * app, so every read and write goes through these wrappers.
 */

export function storageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    const store = window.localStorage
    if (!store) return null
    return store.getItem(key)
  } catch {
    return null
  }
}

export function storageSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage?.setItem(key, value)
  } catch {
    /* storage disabled or sandboxed — the dashboard works fine without it */
  }
}

export function storageRemove(key: string): void {
  try {
    window.localStorage?.removeItem(key)
  } catch {
    /* ignore */
  }
}
