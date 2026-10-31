import { useEffect } from 'react'
import { usePrefs } from '../lib/prefs'
import { modulesSyncAction } from '../lib/userPrefs'
import { useUserPrefs } from './usePrefsSync'

const SYNCED_KEY = 'pref_modules_synced'

function deviceSynced(): boolean {
  try {
    return localStorage.getItem(SYNCED_KEY) === '1'
  } catch {
    return true
  }
}

function markDeviceSynced() {
  try {
    localStorage.setItem(SYNCED_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Module (Ernährung/Community/Smartwatch) zusätzlich in profiles.prefs.modules ablegen,
 * damit der Server sie kennt (z. B. keine Ernährungs-Erinnerungen ohne Ernährung).
 * Auf einem neuen Gerät werden die gespeicherten Module übernommen.
 */
export function useModulesSync(): void {
  const { showNutrition, showSocial, hasWatch, setShowNutrition, setShowSocial, setHasWatch } = usePrefs()
  const { prefs, save, source } = useUserPrefs()
  const remote = prefs.modules
  useEffect(() => {
    if (source === null) return // erst den echten Stand aus dem Konto abwarten
    const local = { nutrition: showNutrition, social: showSocial, watch: hasWatch }
    const action = modulesSyncAction(local, remote, deviceSynced())
    if (action === 'adopt' && remote) {
      if (remote.nutrition !== showNutrition) setShowNutrition(remote.nutrition)
      if (remote.social !== showSocial) setShowSocial(remote.social)
      if (remote.watch !== hasWatch) setHasWatch(remote.watch)
    } else if (action === 'push') {
      void save({ modules: local })
    }
    markDeviceSynced()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, showNutrition, showSocial, hasWatch, remote?.nutrition, remote?.social, remote?.watch])
}
