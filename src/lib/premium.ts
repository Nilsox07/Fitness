// Buddy Plus: Wer darf die KI nutzen?
//
// Kostenlos ist alles, was ohne KI auskommt (Datenbank, Regeln, eigene Daten). Alle KI-Funktionen
// (alles, was über src/lib/ai.ts läuft) gehören zu „Buddy Plus“.
//
// Noch gibt es keine Abrechnung: bis zum Play-Store-Start sind alle Plus. Später setzt
// Play Billing / RevenueCat das Abo über `setBillingEntitlement()` – das ist die einzige Stelle,
// die dafür angefasst werden muss (siehe docs/UEBERGABE.md, Monetarisierung).

/** localStorage: „Kostenlose Version testen“ (Profil → Konto & Daten). */
export const TEST_FREE_KEY = 'plus_test_free'
/** Wird gefeuert, wenn sich der Plus-Status ändert (Test-Schalter oder Abo). */
export const PREMIUM_EVENT = 'premium-change'
/** Öffnet das „Buddy Plus“-Sheet. */
export const OPEN_PLUS_EVENT = 'open-plus'

/**
 * Plus-Status aus dem Abo: `null` = noch keine Abrechnung angebunden (alle sind Plus),
 * `true`/`false` = Abo aktiv bzw. nicht aktiv.
 */
let billing: boolean | null = null

/**
 * HIER später Play Billing / RevenueCat anschließen: nach dem Start und bei jeder Änderung des
 * Abos (z. B. RevenueCat `addCustomerInfoUpdateListener`) mit dem Entitlement „plus“ aufrufen.
 */
export function setBillingEntitlement(active: boolean | null): void {
  billing = active
  emit()
}

export function getBillingEntitlement(): boolean | null {
  return billing
}

/** Reine Regel: Test-Schalter schlägt alles, ohne Abrechnung sind alle Plus. */
export function resolvePremium(i: { billing: boolean | null; testFree: boolean }): boolean {
  if (i.testFree) return false
  if (i.billing === null) return true
  return i.billing
}

export interface AiGateState {
  /** KI-Funktion darf laufen */
  canUse: boolean
  /** KI wäre da, aber nur mit Plus → Funktion zeigen, Tippen öffnet das Plus-Sheet */
  locked: boolean
}

/** Reine Regel für KI-Knöpfe: `aiEnabled` = Server hat KI, `premium` = Plus aktiv. */
export function aiGateState(aiEnabled: boolean, premium: boolean): AiGateState {
  return { canUse: aiEnabled && premium, locked: aiEnabled && !premium }
}

export function getTestFree(): boolean {
  try {
    return localStorage.getItem(TEST_FREE_KEY) === '1'
  } catch {
    return false
  }
}

export function setTestFree(v: boolean): void {
  try {
    if (v) localStorage.setItem(TEST_FREE_KEY, '1')
    else localStorage.removeItem(TEST_FREE_KEY)
  } catch {
    /* ignore */
  }
  emit()
}

/** Aktueller Plus-Status – auch außerhalb von React nutzbar (z. B. in Mutations). */
export function isPremium(): boolean {
  return resolvePremium({ billing, testFree: getTestFree() })
}

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREMIUM_EVENT))
}

/** Für useSyncExternalStore. */
export function subscribePremium(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === TEST_FREE_KEY && cb()
  window.addEventListener(PREMIUM_EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(PREMIUM_EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}

/** „Buddy Plus“-Sheet öffnen (von überall). */
export function openPlusSheet(): void {
  window.dispatchEvent(new Event(OPEN_PLUS_EVENT))
}
