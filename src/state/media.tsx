import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useProductImages, type MediaState } from '../lib/images'
import { useDashboard } from './store'

const MediaContext = createContext<MediaState | null>(null)

export function MediaProvider({ children }: { children: ReactNode }) {
  const { dataset } = useDashboard()
  // Depend on a stable signature so the hook does not reload on every render.
  const state = useProductImages(dataset.perfumes)
  const value = useMemo(() => state, [state])
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
}

export function useMedia(): MediaState {
  const ctx = useContext(MediaContext)
  if (!ctx) throw new Error('useMedia must be used inside <MediaProvider>')
  return ctx
}
