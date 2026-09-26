import { useCallback, useEffect, useState } from 'react'

export type Mode = 'dark' | 'light'

const STORAGE_KEY = 'wahj-theme'

function initialMode(): Mode {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark' // Fire in Darkness is the default
}

export function useTheme() {
  const [mode, setMode] = useState<Mode>(initialMode)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.classList.toggle('light', mode === 'light')
    root.style.colorScheme = mode
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), [])
  return { mode, toggle, setMode }
}

/** Brand palette per theme — charts read these so they stay legible in both modes. */
export function palette(mode: Mode) {
  return mode === 'dark'
    ? {
        local: '#C9A84C',
        online: '#B8560E',
        ember: '#B8560E',
        profit: '#7FB69A',
        neutral: '#6E6A63',
        gold: '#C9A84C',
        bright: '#E4C56B',
        sand: '#D9C9A3',
        grid: 'rgba(255,255,255,0.07)',
        axis: 'rgba(217,201,163,0.55)',
        tooltipBg: 'rgba(18,17,18,0.96)',
        tooltipBorder: 'rgba(201,168,76,0.35)',
        text: '#D9C9A3',
        series: ['#C9A84C', '#B8560E', '#7FB69A', '#8C7BC7', '#5B9BD5', '#D98CA0', '#9A968D'],
      }
    : {
        local: '#A9821B',
        online: '#C2580F',
        ember: '#C2580F',
        profit: '#3F8A66',
        neutral: '#8A8578',
        gold: '#A9821B',
        bright: '#C9A84C',
        sand: '#6B6157',
        grid: 'rgba(10,10,10,0.08)',
        axis: 'rgba(60,52,40,0.65)',
        tooltipBg: 'rgba(255,255,255,0.98)',
        tooltipBorder: 'rgba(169,130,27,0.35)',
        text: '#1A1712',
        series: ['#A9821B', '#C2580F', '#3F8A66', '#6B4FA8', '#2F6FA8', '#B0455F', '#8A8578'],
      }
}
