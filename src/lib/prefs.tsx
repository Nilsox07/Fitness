import { createContext, useContext, useState, type ReactNode } from 'react'

const KEY = 'pref_show_nutrition'
const MODE_KEY = 'pref_app_mode'
const WORLD_KEY = 'pref_world'

/**
 * App-Modus für die Übergangsphase:
 * - 'classic': die alte, schlanke App (reiner Gym-Tracker, keine KI/Gamification/Social)
 * - 'new':     das neue Zwei-Welten-Design mit allen Features
 */
export type AppMode = 'classic' | 'new'

/** Aktive Welt im neuen Design. */
export type World = 'fitness' | 'food'

interface Prefs {
  showNutrition: boolean
  setShowNutrition: (v: boolean) => void
  appMode: AppMode
  setAppMode: (v: AppMode) => void
  /** true, wenn das neue Design aktiv sein soll. */
  isNew: boolean
  world: World
  setWorld: (v: World) => void
}

const PrefsContext = createContext<Prefs>({
  showNutrition: true,
  setShowNutrition: () => {},
  appMode: 'classic',
  setAppMode: () => {},
  isNew: false,
  world: 'fitness',
  setWorld: () => {},
})

function readMode(): AppMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'new' ? 'new' : 'classic'
  } catch {
    return 'classic'
  }
}

function readWorld(): World {
  try {
    return localStorage.getItem(WORLD_KEY) === 'food' ? 'food' : 'fitness'
  } catch {
    return 'fitness'
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [showNutrition, setShow] = useState(() => localStorage.getItem(KEY) !== 'false')
  const [appMode, setMode] = useState<AppMode>(readMode)
  const [world, setWorldState] = useState<World>(readWorld)

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

  function setWorld(v: World) {
    try {
      localStorage.setItem(WORLD_KEY, v)
    } catch {
      /* ignore */
    }
    setWorldState(v)
  }

  return (
    <PrefsContext.Provider
      value={{
        showNutrition,
        setShowNutrition,
        appMode,
        setAppMode,
        isNew: appMode === 'new',
        world,
        setWorld,
      }}
    >
      {children}
    </PrefsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrefs() {
  return useContext(PrefsContext)
}
