// Kleiner globaler Zähler für laufende KI-Anfragen — damit ein sichtbarer,
// animierter Lade-Indikator weiß, ob gerade etwas läuft.

type Listener = (active: number) => void

let active = 0
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l(active)
}

export function aiBegin() {
  active++
  emit()
}

export function aiEnd() {
  active = Math.max(0, active - 1)
  emit()
}

export function aiActiveCount() {
  return active
}

export function subscribeAiActivity(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
