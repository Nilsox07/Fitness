import { useState } from 'react'
import { useToday } from '../../hooks/useToday'
import { useAiStatus } from '../../hooks/useAi'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { usePrefs } from '../../lib/prefs'
import { dailyBriefing } from '../../lib/ai'
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

/** KI-Tagesbriefing (einmal am Tag) – mit allem, was wir über heute wissen. */
export function useBriefing() {
  const t = useToday()
  const { showNutrition, hasWatch } = usePrefs()
  const { prefs } = useUserPrefs()
  const { data: ai } = useAiStatus()
  const [text, setText] = useState(() => stored(t.day))
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      const wd = weekdayIndex(t.day)
      const cardioToday = prefs.cardioPlan?.sessions.find((s) => s.day === wd)
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

  return { text, busy, load, aiOn: !!ai?.enabled }
}
