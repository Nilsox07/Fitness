// „Heute“-Dashboard: welche Widgets gibt es, welche sind sichtbar und in welcher
// Reihenfolge. Die Reihenfolge liegt in profiles.prefs.dashboard (geräteübergreifend).
// Widgets gehören zu einem Modul – ist das Modul aus (z. B. keine Uhr), verschwinden sie.

export type Module = 'training' | 'nutrition' | 'social' | 'watch'

export type WidgetId =
  | 'readiness'
  | 'nextWorkout'
  | 'streak'
  | 'kcal'
  | 'water'
  | 'quests'
  | 'sleep'
  | 'steps'
  | 'lastActivity'
  | 'cardioWeek'
  | 'supplements'
  | 'weight'
  | 'friends'
  | 'lastWorkout'

export interface WidgetDef {
  id: WidgetId
  label: string
  hint: string
  module: Module
  /** 'half' = halbe Breite (zwei nebeneinander) */
  size: 'full' | 'half'
}

export const WIDGETS: WidgetDef[] = [
  {
    id: 'readiness',
    label: 'Tagesform',
    hint: 'Schlaf, Erholung & Essen in einer Zahl',
    module: 'watch',
    size: 'full',
  },
  {
    id: 'nextWorkout',
    label: 'Nächstes Training',
    hint: 'Was heute ansteht – direkt starten',
    module: 'training',
    size: 'full',
  },
  { id: 'kcal', label: 'Kalorien & Eiweiß', hint: 'Was heute noch offen ist', module: 'nutrition', size: 'full' },
  { id: 'water', label: 'Wasser', hint: 'Mit +250 ml direkt eintragen', module: 'nutrition', size: 'half' },
  { id: 'streak', label: 'Serie', hint: 'Wochen in Folge & Ziel dieser Woche', module: 'training', size: 'half' },
  { id: 'sleep', label: 'Schlaf', hint: 'Letzte Nacht von deiner Uhr', module: 'watch', size: 'half' },
  { id: 'steps', label: 'Schritte', hint: 'Heute von deiner Uhr', module: 'watch', size: 'half' },
  {
    id: 'lastActivity',
    label: 'Letzte Aktivität',
    hint: 'Lauf, Radtour & Co. von der Uhr',
    module: 'watch',
    size: 'full',
  },
  {
    id: 'cardioWeek',
    label: 'Ausdauer-Woche',
    hint: 'Kilometer & Minuten dieser Woche',
    module: 'watch',
    size: 'half',
  },
  { id: 'quests', label: 'Quests', hint: 'Tagesaufgaben für XP', module: 'training', size: 'full' },
  { id: 'lastWorkout', label: 'Letztes Training', hint: 'Dauer, Sätze, Volumen', module: 'training', size: 'half' },
  { id: 'supplements', label: 'Supplemente', hint: 'Heute abhaken', module: 'nutrition', size: 'full' },
  { id: 'weight', label: 'Gewicht', hint: 'Trend & schnell eintragen', module: 'training', size: 'full' },
  { id: 'friends', label: 'Freunde', hint: 'Wer heute schon aktiv war', module: 'social', size: 'full' },
]

const BY_ID = new Map(WIDGETS.map((w) => [w.id, w]))

export function widgetDef(id: WidgetId): WidgetDef {
  return BY_ID.get(id)!
}

export const DEFAULT_LAYOUT: WidgetId[] = [
  'readiness',
  'nextWorkout',
  'kcal',
  'water',
  'streak',
  'sleep',
  'steps',
  'lastActivity',
  'quests',
  'friends',
]

export type Modules = Record<Module, boolean>

const isOn = (id: WidgetId, mods: Modules) => mods[widgetDef(id).module]

/** Gespeicherte Reihenfolge → gültige, sichtbare Widgets (Unbekanntes und Doppeltes fliegt raus). */
export function visibleLayout(saved: readonly string[] | null | undefined, mods: Modules): WidgetId[] {
  const src = saved ?? DEFAULT_LAYOUT
  const seen = new Set<string>()
  const out: WidgetId[] = []
  for (const id of src) {
    if (seen.has(id) || !BY_ID.has(id as WidgetId)) continue
    seen.add(id)
    if (isOn(id as WidgetId, mods)) out.push(id as WidgetId)
  }
  return out
}

/** Widgets, die man noch hinzufügen kann (Modul an, aber nicht auf „Heute“). */
export function addableWidgets(saved: readonly string[] | null | undefined, mods: Modules): WidgetDef[] {
  const shown = new Set(visibleLayout(saved, mods))
  return WIDGETS.filter((w) => mods[w.module] && !shown.has(w.id))
}

/**
 * Neue Reihenfolge speichern, ohne ausgeblendete Widgets (Modul aus) zu verlieren:
 * sie bleiben hinten in der Liste und tauchen wieder auf, wenn das Modul angeht.
 */
export function mergeLayout(
  saved: readonly string[] | null | undefined,
  visible: readonly WidgetId[],
  mods: Modules,
): WidgetId[] {
  const hidden = (saved ?? DEFAULT_LAYOUT).filter(
    (id): id is WidgetId =>
      BY_ID.has(id as WidgetId) && !isOn(id as WidgetId, mods) && !visible.includes(id as WidgetId),
  )
  return [...visible, ...hidden]
}

/** Element von Position `from` nach `to` verschieben. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list]
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, x)
  return next
}

/** Beim Einschalten der Uhr: ihre wichtigsten Widgets ergänzen, falls sie fehlen. */
export function withWatchWidgets(saved: readonly string[] | null | undefined): string[] | null {
  if (!saved) return null
  const add = (['readiness', 'sleep', 'steps', 'lastActivity'] as const).filter((id) => !saved.includes(id))
  return add.length ? [add[0], ...saved, ...add.slice(1)] : [...saved]
}
