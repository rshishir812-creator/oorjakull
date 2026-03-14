import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem('yoga-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // ignore
  }
  return null
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme())

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem('yoga-theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggle = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, setTheme: setThemeState, toggle } as const
}
