// „Heute“-Dashboard: welche Widgets gibt es, welche sind sichtbar und in welcher
// Reihenfolge. Die Reihenfolge liegt in profiles.prefs.dashboard (geräteübergreifend).
// Widgets gehören zu einem Modul – ist das Modul aus (z. B. keine Uhr), verschwinden sie.

import type { Capabilities, Capability } from './health'

export type Module = 'training' | 'nutrition' | 'social' | 'watch' | 'cycle' | 'hybrid'

export type WidgetId =
  | 'readiness'
  | 'nextWorkout'
  | 'cardioPlan'
  | 'cycle'
  | 'streak'
  | 'kcal'
  | 'water'
  | 'quests'
  | 'sleep'
  | 'steps'
  | 'lastActivity'
  | 'cardioWeek'
  | 'heart'
  | 'supplements'
  | 'weight'
  | 'friends'
  | 'lastWorkout'
  | 'bedtime'
  | 'journal'

export interface WidgetDef {
  id: WidgetId
  label: string
  hint: string
  module: Module
  /** 'half' = halbe Breite (zwei nebeneinander) */
  size: 'full' | 'half'
  /** Uhr muss mindestens einen dieser Werte liefern (sonst wird das Widget ausgeblendet) */
  needs?: Capability[]
}

export const WIDGETS: WidgetDef[] = [
  {
    id: 'readiness',
    label: 'Tagesform',
    hint: 'Schlaf, Erholung & Essen in einer Zahl',
    module: 'watch',
    size: 'full',
    needs: ['sleep', 'hrv', 'restingHr'],
  },
  {
    id: 'nextWorkout',
    label: 'Nächstes Training',
    hint: 'Was heute ansteht – direkt starten',
    module: 'training',
    size: 'full',
  },
  { id: 'cycle', label: 'Zyklus', hint: 'Phase, Tag & was das fürs Training heißt', module: 'cycle', size: 'full' },
  { id: 'cardioPlan', label: 'Ausdauer-Plan', hint: 'Heutige Einheit abhaken', module: 'hybrid', size: 'full' },
  { id: 'kcal', label: 'Kalorien & Eiweiß', hint: 'Was heute noch offen ist', module: 'nutrition', size: 'full' },
  { id: 'water', label: 'Wasser', hint: 'Mit +250 ml direkt eintragen', module: 'nutrition', size: 'half' },
  { id: 'streak', label: 'Serie', hint: 'Wochen in Folge & Ziel dieser Woche', module: 'training', size: 'half' },
  {
    id: 'sleep',
    label: 'Schlaf',
    hint: 'Letzte Nacht von deiner Uhr',
    module: 'watch',
    size: 'half',
    needs: ['sleep'],
  },
  {
    id: 'bedtime',
    label: 'Schlafenszeit',
    hint: 'Schlafbedarf heute & wann ins Bett',
    module: 'watch',
    size: 'half',
    needs: ['sleep'],
  },
  { id: 'journal', label: 'Journal', hint: 'Gewohnheiten antippen – was hilft dir?', module: 'training', size: 'full' },
  { id: 'steps', label: 'Schritte', hint: 'Heute von deiner Uhr', module: 'watch', size: 'half', needs: ['steps'] },
  {
    id: 'heart',
    label: 'Herz',
    hint: 'Ruhepuls & Erholung (HRV) heute',
    module: 'watch',
    size: 'half',
    needs: ['restingHr', 'hrv'],
  },
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
  'cycle',
  'cardioPlan',
  'kcal',
  'water',
  'streak',
  'sleep',
  'bedtime',
  'steps',
  'journal',
  'lastActivity',
  'quests',
  'friends',
]

export type Modules = Record<Exclude<Module, 'cycle' | 'hybrid'>, boolean> & { cycle?: boolean; hybrid?: boolean }

const isOn = (id: WidgetId, mods: Modules) => !!mods[widgetDef(id).module]

/** Liefert die Uhr die nötigen Werte? Solange noch nichts synchronisiert ist: ja (abwarten). */
export function supported(w: WidgetDef, caps?: Capabilities | null): boolean {
  if (!w.needs || !caps?.known) return true
  return w.needs.some((n) => caps.has[n])
}

/** Gespeicherte Reihenfolge → gültige, sichtbare Widgets (Unbekanntes und Doppeltes fliegt raus). */
export function visibleLayout(
  saved: readonly string[] | null | undefined,
  mods: Modules,
  caps?: Capabilities | null,
): WidgetId[] {
  const src = saved ?? DEFAULT_LAYOUT
  const seen = new Set<string>()
  const out: WidgetId[] = []
  for (const id of src) {
    if (seen.has(id) || !BY_ID.has(id as WidgetId)) continue
    seen.add(id)
    if (isOn(id as WidgetId, mods) && supported(widgetDef(id as WidgetId), caps)) out.push(id as WidgetId)
  }
  return out
}

/** Widgets, die man noch hinzufügen kann (Modul an, aber nicht auf „Heute“). */
export function addableWidgets(
  saved: readonly string[] | null | undefined,
  mods: Modules,
  caps?: Capabilities | null,
): WidgetDef[] {
  const shown = new Set(visibleLayout(saved, mods, caps))
  return WIDGETS.filter((w) => mods[w.module] && supported(w, caps) && !shown.has(w.id))
}

/**
 * Neue Reihenfolge speichern, ohne ausgeblendete Widgets (Modul aus) zu verlieren:
 * sie bleiben hinten in der Liste und tauchen wieder auf, wenn das Modul angeht.
 */
export function mergeLayout(
  saved: readonly string[] | null | undefined,
  visible: readonly WidgetId[],
  mods: Modules,
  caps?: Capabilities | null,
): WidgetId[] {
  // Behalten: was nur ausgeblendet ist (Modul aus oder Uhr liefert den Wert nicht) – nicht, was entfernt wurde
  const hidden = (saved ?? DEFAULT_LAYOUT).filter(
    (id): id is WidgetId =>
      BY_ID.has(id as WidgetId) &&
      !visible.includes(id as WidgetId) &&
      (!isOn(id as WidgetId, mods) || !supported(widgetDef(id as WidgetId), caps)),
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

/** Widget nach einem anderen einfügen (nur bei eigener Reihenfolge; Standard enthält es schon). */
export function withWidget(saved: string[] | null, id: WidgetId, after: WidgetId): string[] | null {
  if (!saved || saved.includes(id)) return saved
  const i = saved.indexOf(after)
  return i < 0 ? [id, ...saved] : [...saved.slice(0, i + 1), id, ...saved.slice(i + 1)]
}
