// Eigene Einkaufsliste „Fehlt mir“ (unabhängig vom Essensplan): einfache Artikel, abhakbar.
// Liegt auf dem Gerät (localStorage); andere Teile der App (z. B. Nachkochen) fügen hier Artikel hinzu.

export interface ShoppingExtra {
  id: string
  text: string
  done: boolean
}

const KEY = 'shopping_extras'
const listeners = new Set<() => void>()
let cache: ShoppingExtra[] | null = null

/** Artikel hinzufügen; gleicher Text (ohne Groß/Klein) offen → nicht doppelt, abgehakt → wieder offen. */
export function addExtraItem(list: readonly ShoppingExtra[], text: string, id = newId()): ShoppingExtra[] {
  const t = text.trim().replace(/\s+/g, ' ').slice(0, 120)
  if (!t) return [...list]
  const same = list.find((x) => x.text.toLowerCase() === t.toLowerCase())
  if (same) return list.map((x) => (x === same ? { ...x, done: false } : x))
  return [...list, { id, text: t, done: false }]
}

export function toggleExtraItem(list: readonly ShoppingExtra[], id: string): ShoppingExtra[] {
  return list.map((x) => (x.id === id ? { ...x, done: !x.done } : x))
}

export function removeExtraItem(list: readonly ShoppingExtra[], id: string): ShoppingExtra[] {
  return list.filter((x) => x.id !== id)
}

/** Abgehakte entfernen. */
export function clearDoneExtras(list: readonly ShoppingExtra[]): ShoppingExtra[] {
  return list.filter((x) => !x.done)
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

// ---- Speicher (Gerät) ----

export function loadExtras(): ShoppingExtra[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown
    cache = Array.isArray(raw)
      ? raw
          .filter((x): x is ShoppingExtra => !!x && typeof x.id === 'string' && typeof x.text === 'string')
          .map((x) => ({ id: x.id, text: x.text, done: !!x.done }))
      : []
  } catch {
    cache = []
  }
  return cache
}

export function saveExtras(list: ShoppingExtra[]): void {
  cache = list
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn())
}

/** Bequem: Artikel direkt in die gespeicherte Liste legen. */
export function addToShoppingList(text: string): void {
  saveExtras(addExtraItem(loadExtras(), text))
}

export function subscribeExtras(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
