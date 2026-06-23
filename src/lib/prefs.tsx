import { createContext, useContext, useState, type ReactNode } from 'react'

const KEY = 'pref_show_nutrition'

interface Prefs {
  showNutrition: boolean
  setShowNutrition: (v: boolean) => void
}

const PrefsContext = createContext<Prefs>({
  showNutrition: true,
  setShowNutrition: () => {},
})

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [showNutrition, setShow] = useState(() => localStorage.getItem(KEY) !== 'false')

  function setShowNutrition(v: boolean) {
    localStorage.setItem(KEY, v ? 'true' : 'false')
    setShow(v)
  }

  return (
    <PrefsContext.Provider value={{ showNutrition, setShowNutrition }}>
      {children}
    </PrefsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrefs() {
  return useContext(PrefsContext)
}
