import { useCallback, useSyncExternalStore } from 'react'
import { useAiStatus } from './useAi'
import { aiGateState, getTestFree, isPremium, openPlusSheet, setTestFree, subscribePremium } from '../lib/premium'

/** Plus-Status (reagiert auf den Test-Schalter und später auf das Abo). */
export function usePremium() {
  const premium = useSyncExternalStore(subscribePremium, isPremium, () => true)
  const testFree = useSyncExternalStore(subscribePremium, getTestFree, () => false)
  return { premium, testFree, setTestFree }
}

export interface AiGate {
  /** KI-Status geladen */
  ready: boolean
  /** Server hat KI */
  enabled: boolean
  premium: boolean
  /** KI darf laufen */
  canUse: boolean
  /** KI da, aber ohne Plus → Funktion zeigen, mit Plus-Badge */
  locked: boolean
  /** Vor jedem KI-Aufruf: true = weiter; sonst öffnet es (falls gesperrt) das Plus-Sheet. */
  requirePlus: () => boolean
  /** Für <label> mit Datei-Auswahl: verhindert das Öffnen ohne Plus. */
  guard: (e: { preventDefault: () => void }) => void
}

/** Zentrale Sperre für alle KI-Funktionen. */
export function useAiGate(): AiGate {
  const { data: ai } = useAiStatus()
  const { premium } = usePremium()
  const enabled = Boolean(ai?.enabled)
  const { canUse, locked } = aiGateState(enabled, premium)
  const requirePlus = useCallback(() => {
    if (canUse) return true
    if (locked) openPlusSheet()
    return false
  }, [canUse, locked])
  const guard = useCallback(
    (e: { preventDefault: () => void }) => {
      if (!requirePlus()) e.preventDefault()
    },
    [requirePlus],
  )
  return { ready: ai !== undefined, enabled, premium, canUse, locked, requirePlus, guard }
}
