import { useEffect } from 'react'
import { usePrefs } from '../lib/prefs'
import { takeLegacyShareCheat } from '../lib/push'
import { useUserPrefs } from './usePrefsSync'

/**
 * „Meine Cheat-Meals teilen“: im Konto gespeichert (Standard aus) und nur mit
 * eingeschalteter Community wirksam. Übernimmt einmalig die alte lokale Wahl.
 */
export function useShareCheat(): { enabled: boolean; on: boolean; set: (on: boolean) => void } {
  const { showSocial } = usePrefs()
  const { prefs, save, source } = useUserPrefs()
  useEffect(() => {
    if (source === null) return
    if (takeLegacyShareCheat() && !prefs.shareCheat) void save({ shareCheat: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])
  return {
    enabled: showSocial && prefs.shareCheat,
    on: prefs.shareCheat,
    set: (on: boolean) => void save({ shareCheat: on }),
  }
}
