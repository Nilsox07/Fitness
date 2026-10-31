// Zurück-Taste (Android): offene Sheets/Overlays melden sich hier an. Ist eins offen,
// schließt „Zurück“ zuerst das oberste – statt die Seite darunter zu wechseln.
// Reine Logik – getestet in backStack.test.ts.

import { useEffect, useRef } from 'react'

type Handler = () => void

const stack: { id: number; run: () => void }[] = []
let nextId = 1

/** Handler oben auf den Stapel legen; gibt eine Funktion zum Entfernen zurück. */
export function pushBack(handler: Handler): () => void {
  const id = nextId++
  stack.push({ id, run: handler })
  return () => {
    const i = stack.findIndex((e) => e.id === id)
    if (i >= 0) stack.splice(i, 1)
  }
}

/** Obersten Handler ausführen. false = keiner offen (dann normal zurück). */
export function handleBack(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top.run()
  return true
}

export function backStackSize(): number {
  return stack.length
}

export function _resetBackStack(): void {
  stack.length = 0
}

/** Solange `active`, schließt die Zurück-Taste über `onClose` (immer die aktuelle Funktion). */
export function useBackClose(onClose: Handler, active = true): void {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (!active) return
    return pushBack(() => ref.current())
  }, [active])
}
