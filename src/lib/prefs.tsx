import { createContext, useContext, useState, type ReactNode } from 'react'

const KEY = 'pref_show_nutrition'
const MODE_KEY = 'pref_app_mode'

/**
 * App-Modus für die Übergangsphase:
 * - 'classic': schlanke, stabile Basis (Training, Essen, Verlauf, Auswertung, Übungen)
 * - 'new':     alle neuen Features (KI-Assistent, Gamification, Social, KI-Ernährung …)
 */
export type AppMode = 'classic' | 'new'

interface Prefs {
  showNutrition: boolean
  setShowNutrition: (v: boolean) => void
  appMode: AppMode
  setAppMode: (v: AppMode) => void
  /** true, wenn die neuen Features aktiv sein sollen. */
  isNew: boolean
}

const PrefsContext = createContext<Prefs>({
  showNutrition: true,
  setShowNutrition: () => {},
  appMode: 'classic',
  setAppMode: () => {},
  isNew: false,
})

function readMode(): AppMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'new' ? 'new' : 'classic'
  } catch {
    return 'classic'
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [showNutrition, setShow] = useState(() => localStorage.getItem(KEY) !== 'false')
  const [appMode, setMode] = useState<AppMode>(readMode)

  function setShowNutrition(v: boolean) {
    localStorage.setItem(KEY, v ? 'true' : 'false')
    setShow(v)
  }

  function setAppMode(v: AppMode) {
    try {
      localStorage.setItem(MODE_KEY, v)
    } catch {
      /* ignore */
    }
    setMode(v)
  }

  return (
    <PrefsContext.Provider
      value={{ showNutrition, setShowNutrition, appMode, setAppMode, isNew: appMode === 'new' }}
    >
      {children}
    </PrefsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrefs() {
  return useContext(PrefsContext)
}
