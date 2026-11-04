import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
/** Dunkler Stil: neutrales Fast-Schwarz (Standard) oder das frühere Blaugrau */
export type DarkStyle = 'black' | 'midnight'
type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const STYLE_KEY = 'theme_dark_style'

function applyDarkStyle(s: DarkStyle) {
  document.documentElement.classList.toggle('midnight', s === 'midnight')
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Setzt/entfernt die .dark-Klasse und gibt den aufgelösten Modus zurück. */
function applyTheme(mode: ThemeMode): Resolved {
  const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
  return dark ? 'dark' : 'light'
}

interface ThemeState {
  mode: ThemeMode
  resolved: Resolved
  setMode: (m: ThemeMode) => void
  toggle: () => void
  darkStyle: DarkStyle
  setDarkStyle: (s: DarkStyle) => void
}

const ThemeContext = createContext<ThemeState>({
  mode: 'system',
  resolved: 'light',
  setMode: () => {},
  toggle: () => {},
  darkStyle: 'black',
  setDarkStyle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system',
  )
  const [resolved, setResolved] = useState<Resolved>(() => applyTheme(mode))
  const [darkStyle, setDarkStyleState] = useState<DarkStyle>(() => {
    const s: DarkStyle = localStorage.getItem(STYLE_KEY) === 'midnight' ? 'midnight' : 'black'
    applyDarkStyle(s)
    return s
  })
  function setDarkStyle(s: DarkStyle) {
    localStorage.setItem(STYLE_KEY, s)
    applyDarkStyle(s)
    setDarkStyleState(s)
  }

  // Bei Moduswechsel anwenden
  useEffect(() => {
    setResolved(applyTheme(mode))
  }, [mode])

  // System-Änderungen verfolgen, solange „system" aktiv ist
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system') === 'system') {
        setResolved(applyTheme('system'))
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function setMode(m: ThemeMode) {
    localStorage.setItem(STORAGE_KEY, m)
    setModeState(m)
  }

  function toggle() {
    setMode(resolved === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle, darkStyle, setDarkStyle }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
