import { useMemo, useState } from 'react'
import { useToday } from '../../hooks/useToday'
import { useAiGate } from '../../hooks/usePremium'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { usePrefs } from '../../lib/prefs'
import { dailyBriefing } from '../../lib/ai'
import { dailyBriefingText } from '../../lib/freeTexts'
import { hoursText } from '../../lib/health'
import { WEEKDAYS, cardioTitle } from '../../lib/onboarding'
import { weekdayIndex } from '../../lib/schedule'

const BRIEFING_KEY = 'buddy_briefing'

function stored(day: string): string | null {
  try {
    const b = JSON.parse(localStorage.getItem(BRIEFING_KEY) || 'null') as { day: string; text: string } | null
    return b?.day === day ? b.text : null
  } catch {
    return null
  }
}

/**
 * Tagesbriefing: mit Buddy Plus einmal am Tag von der KI (auf Knopfdruck), sonst sofort als
 * fester Text aus `freeTexts.ts` (auch, wenn die KI nicht da ist).
 */
export function useBriefing() {
  const t = useToday()
  const { showNutrition, hasWatch } = usePrefs()
  const { prefs } = useUserPrefs()
  const gate = useAiGate()
  const [aiText, setText] = useState(() => stored(t.day))
  const [busy, setBusy] = useState(false)
  const wd = weekdayIndex(t.day)
  const cardioToday = prefs.cardioPlan?.sessions.find((s) => s.day === wd)

  const hour = new Date().getHours()
  const freeText = useMemo(
    () =>
      dailyBriefingText({
        day: t.day,
        hour,
        readiness: t.readiness,
        trainedToday: t.trainedToday,
        restDay: t.restDay,
        nextWorkout: t.nextWorkout,
        weekDone: t.weekDone,
        weekGoal: t.weekGoal,
        cardioToday: cardioToday ? cardioTitle(cardioToday) : null,
        nutrition: showNutrition
          ? {
              kcalEaten: t.kcalEaten,
              kcalTarget: t.kcalTarget,
              proteinEaten: t.proteinEaten,
              proteinTarget: t.proteinTarget,
              waterMl: t.waterMl,
              waterTarget: t.waterTarget,
            }
          : null,
      }),
    [t, hour, cardioToday, showNutrition],
  )

  async function load() {
    if (!gate.requirePlus()) return
    setBusy(true)
    try {
      const out = await dailyBriefing({
        uhrzeit: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        wochentag: WEEKDAYS[wd],
        tagesform: t.readiness
          ? {
              wert: t.readiness.score,
              faktoren: t.readiness.factors.map((f) => `${f.label}: ${f.value} (${f.status})`),
            }
          : null,
        training: {
          heuteErledigt: t.trainedToday,
          ruhetag: t.restDay,
          geplant: t.nextWorkout,
          woche: `${t.weekDone}/${t.weekGoal}`,
          ausdauerHeute: cardioToday ? cardioTitle(cardioToday) : null,
        },
        uhr: hasWatch
          ? {
              schlaf: t.sleep ? hoursText(t.sleep.asleep_min) : null,
              ruhepuls: t.restingHr,
              hrv: t.hrv,
              schritte: t.steps,
              ausdauerWocheKm: t.cardioWeek ? Math.round(t.cardioWeek.distance_m / 100) / 10 : null,
            }
          : null,
        ernaehrung: showNutrition
          ? {
              kcal: `${t.kcalEaten}/${t.kcalTarget}`,
              eiweiss: `${t.proteinEaten}/${t.proteinTarget} g`,
              wasser: `${t.waterMl}/${t.waterTarget} ml`,
            }
          : null,
      })
      setText(out)
      try {
        localStorage.setItem(BRIEFING_KEY, JSON.stringify({ day: t.day, text: out }))
      } catch {
        /* ignore */
      }
    } catch {
      /* Fehler: Knopf bleibt, man kann es nochmal versuchen */
    } finally {
      setBusy(false)
    }
  }

  // Plus: KI-Text (nach Knopfdruck); kostenlos: fester Text sofort.
  const text = gate.canUse ? aiText : freeText
  return { text, busy, load, aiOn: gate.canUse, locked: gate.locked, available: true }
}
