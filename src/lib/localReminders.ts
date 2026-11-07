// Erinnerungen direkt auf dem Handy (Android-App): Web-Push gibt es dort nicht. Die App plant die
// Benachrichtigungen für heute und morgen selbst – nach den Einstellungen (Profil → Benachrichtigungen)
// und nur, wenn noch etwas fehlt. Bei jedem Öffnen bzw. jeder Änderung wird neu geplant.
// Reine Logik – getestet in localReminders.test.ts.

import type { NotifyKind, NotifyPrefs } from './notify'
import { daySeed, reminderCopy, type ReminderCtx as CopyCtx, type ReminderKind } from '../../api/_reminderCopy.js'

export interface ReminderCtx {
  now: Date
  notify: NotifyPrefs
  showNutrition: boolean
  /** Mahlzeit heute schon eingetragen? */
  meals: { breakfast: boolean; lunch: boolean; dinner: boolean }
  kcalLeft: number
  waterMl: number
  waterTarget: number
  proteinEaten: number
  proteinTarget: number
  trainedToday: boolean
  /** Geplante Trainingstage (YYYY-MM-DD); leer = kein fester Rhythmus */
  trainingDays: string[]
  /** Tage seit dem letzten Training (null = noch nie) */
  daysSinceTraining: number | null
  nextWorkout: string | null
  /** Supplement-Einnahmen: heute (offset 0) und morgen (1) */
  supplements: { name: string; time: string; taken: boolean; dayOffset: 0 | 1 }[]
  /** Essensfenster (Intervallfasten) als „HH:MM“ */
  fasting: { open: string; close: string } | null
  /** Empfohlene Zubettgehzeit „H:MM“ + Schlafbedarf (nur mit Uhr) */
  bedtime?: { bedAt: string; need: string } | null
}

export interface Reminder {
  id: number
  at: Date
  title: string
  body: string
  /** Seite, die beim Antippen öffnet */
  route: string
}

/** Feste ID-Bereiche je Art (×10 je Tag + laufende Nummer) – so lassen sich alle sauber abbrechen. */
const BASE: Record<NotifyKind, number> = {
  breakfast: 8000,
  lunch: 8020,
  dinner: 8040,
  water: 8060,
  protein: 8080,
  fasting: 8100,
  supplements: 8200,
  workout: 8300,
  streak: 8320,
  weigh: 8340,
  review: 8360,
  body: 8380,
  social: 8400,
  bedtime: 8420,
}
export const REMINDER_ID_MIN = 8000
export const REMINDER_ID_MAX = 8499

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function at(day: Date, hhmm: string, offsetMin = 0): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h || 0, (m || 0) + offsetMin, 0, 0)
  return d
}

/** 0 = Mo … 6 = So */
const weekday = (d: Date) => (d.getDay() + 6) % 7

export function planReminders(c: ReminderCtx): Reminder[] {
  const out: Reminder[] = []
  const n = c.notify
  const today = new Date(c.now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const add = (
    kind: NotifyKind,
    dayOffset: 0 | 1,
    slot: number,
    when: Date,
    title: string,
    body: string,
    route: string,
  ) => {
    if (when.getTime() <= c.now.getTime() + 30_000) return // Vergangenes nicht planen
    out.push({ id: BASE[kind] + dayOffset * 10 + slot, at: when, title, body, route })
  }

  for (const off of [0, 1] as const) {
    const day = off === 0 ? today : tomorrow
    const isToday = off === 0
    const seed = daySeed(day)
    /** Gemeinsame Formulierungen (wie Web-Push): Titel + Text je Art */
    const text = (k: ReminderKind, ctx: CopyCtx = {}, extra = 0) => reminderCopy(k, ctx, seed + extra)!

    // ---------- Ernährung ----------
    if (c.showNutrition) {
      const meal = (kind: 'breakfast' | 'lunch' | 'dinner') => {
        const s = n[kind]
        if (!s.on || !s.time || (isToday && c.meals[kind])) return
        const t = text(kind, { kcalLeft: isToday ? c.kcalLeft : 0 })
        add(kind, off, 0, at(day, s.time), t.title, t.body, '/nutrition?add=menu')
      }
      meal('breakfast')
      meal('lunch')
      meal('dinner')

      if (n.water.on && n.water.time && (!isToday || c.waterMl < c.waterTarget / 2)) {
        const t = text('water', { drankL: isToday ? c.waterMl / 1000 : 0, targetL: c.waterTarget / 1000 })
        add('water', off, 0, at(day, n.water.time), t.title, t.body, '/nutrition')
      }

      const proteinLeft = c.proteinTarget - c.proteinEaten
      if (n.protein.on && n.protein.time && c.proteinTarget > 0 && (!isToday || proteinLeft > c.proteinTarget / 4)) {
        const t = text('protein', { missing: isToday ? proteinLeft : c.proteinTarget })
        add('protein', off, 0, at(day, n.protein.time), t.title, t.body, '/nutrition')
      }

      if (n.fasting.on && c.fasting) {
        const o = text('fasting_open', { end: c.fasting.close })
        add('fasting', off, 0, at(day, c.fasting.open), o.title, o.body, '/nutrition')
        const cl = text('fasting_close')
        add('fasting', off, 1, at(day, c.fasting.close, -30), cl.title, cl.body, '/nutrition')
      }

      if (n.supplements.on)
        c.supplements
          .filter((s) => s.dayOffset === off && !s.taken)
          .slice(0, 9)
          .forEach((s, i) => {
            const t = text('supplement', { name: s.name })
            add('supplements', off, i, at(day, s.time), t.title, t.body, '/nutrition')
          })
    }

    // ---------- Training ----------
    const planned = c.trainingDays.includes(ymd(day))
    if (n.workout.on && n.workout.time && planned && !(isToday && c.trainedToday)) {
      const t = text('workout', { plan: isToday ? c.nextWorkout : null })
      add('workout', off, 0, at(day, n.workout.time), t.title, t.body, '/')
    }

    // Sanft, ohne Schuldgefühle: nach 3+ Tagen Pause einmal erinnern
    const pause = c.daysSinceTraining == null ? null : c.daysSinceTraining + off
    if (n.streak.on && n.streak.time && pause != null && pause >= 3 && !(isToday && c.trainedToday) && !planned) {
      const t = text('streak', { days: pause })
      add('streak', off, 0, at(day, n.streak.time), t.title, t.body, '/')
    }

    // ---------- Fortschritt ----------
    if (n.weigh.on && n.weigh.time && (n.weigh.days ?? [0]).includes(weekday(day))) {
      const t = text('weigh')
      add('weigh', off, 0, at(day, n.weigh.time), t.title, t.body, '/body?weigh=1')
    }

    // Schlafenszeit: 30 min vorher; nach Mitternacht zählt sie zum nächsten Tag
    if (n.bedtime.on && c.bedtime) {
      const [h] = c.bedtime.bedAt.split(':').map(Number)
      const base = new Date(day)
      if (h < 12) base.setDate(base.getDate() + 1)
      const t = text('bedtime', { bedAt: c.bedtime.bedAt, need: c.bedtime.need })
      add('bedtime', off, 0, at(base, c.bedtime.bedAt, -30), t.title, t.body, '/sleep')
    }

    if (n.review.on && n.review.time && weekday(day) === 0) {
      const t = text('review')
      add('review', off, 0, at(day, n.review.time), t.title, t.body, '/profile?s=review')
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}
