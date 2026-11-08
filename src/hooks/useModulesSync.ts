import { useEffect } from 'react'
import { HYBRID_KEY, usePrefs } from '../lib/prefs'
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

function hybridFlagSet(): boolean {
  try {
    return localStorage.getItem(HYBRID_KEY) != null
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
  const {
    showNutrition,
    showSocial,
    hasWatch,
    hasCycle,
    hasHybrid,
    setShowNutrition,
    setShowSocial,
    setHasWatch,
    setHasCycle,
    setHasHybrid,
  } = usePrefs()
  const { prefs, save, source } = useUserPrefs()
  const remote = prefs.modules
  useEffect(() => {
    if (source === null) return // erst den echten Stand aus dem Konto abwarten
    // Ältere Stände kennen „Hybrid“ noch nicht: an, wenn ein Ausdauer-Plan existiert
    if (remote && remote.hybrid === undefined && !hybridFlagSet() && !!prefs.cardioPlan && !hasHybrid) {
      setHasHybrid(true)
      return
    }
    const local = { nutrition: showNutrition, social: showSocial, watch: hasWatch, cycle: hasCycle, hybrid: hasHybrid }
    const action = modulesSyncAction(local, remote, deviceSynced())
    if (action === 'adopt' && remote) {
      if (remote.nutrition !== showNutrition) setShowNutrition(remote.nutrition)
      if (remote.social !== showSocial) setShowSocial(remote.social)
      if (remote.watch !== hasWatch) setHasWatch(remote.watch)
      if (!!remote.cycle !== hasCycle) setHasCycle(!!remote.cycle)
      if (remote.hybrid !== undefined && remote.hybrid !== hasHybrid) setHasHybrid(remote.hybrid)
    } else if (action === 'push') {
      void save({ modules: local })
    }
    markDeviceSynced()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    source,
    showNutrition,
    showSocial,
    hasWatch,
    hasCycle,
    hasHybrid,
    remote?.hybrid,
    remote?.nutrition,
    remote?.social,
    remote?.watch,
    remote?.cycle,
  ])
}
