import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, X } from 'lucide-react'
import { BuddyFace } from './BuddyFace'
import { useBuddy } from './useBuddy'
import { openBuddySheet } from './BuddySheet'
import { useToday } from '../../hooks/useToday'
import { useAiStatus } from '../../hooks/useAi'
import { useHealthDaily } from '../../hooks/useHealth'
import { useLeaderboard } from '../../hooks/useSocial'
import { useAuth } from '../../lib/auth'
import { usePrefs } from '../../lib/prefs'
import { baseline } from '../../lib/health'
import { useBriefing } from './useBriefing'
import { pageTip, type TipPage } from '../../lib/buddyTips'

const HIDDEN_KEY = 'buddy_tip_hidden'

function hiddenToday(key: string, day: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(HIDDEN_KEY) || '{}') as Record<string, string>)[key] === day
  } catch {
    return false
  }
}
function hideToday(key: string, day: string) {
  try {
    const m = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '{}') as Record<string, string>
    m[key] = day
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

/**
 * Buddy begleitet durch die App: oben auf jeder Hauptseite ein kurzer Tipp aus deinen
 * Daten, mit passendem Knopf und „Frag Buddy“ (KI). Für heute wegtippbar.
 * Auf „Heute“ ohne Uhr zusätzlich das KI-Tagesbriefing (mit Uhr: in der Tagesform-Karte).
 */
export function BuddyTip({ page, style }: { page: TipPage; style?: CSSProperties }) {
  const navigate = useNavigate()
  const t = useToday()
  const buddy = useBuddy()
  const { user } = useAuth()
  const { showNutrition, showSocial, hasWatch } = usePrefs()
  const { data: ai } = useAiStatus()
  const { data: daily } = useHealthDaily(30)
  const { data: board } = useLeaderboard()
  const [hidden, setHidden] = useState(false)
  // Mit Uhr steckt das Tagesbriefing in der Tagesform-Karte – sonst hier
  const brief = useBriefing()
  const withBriefing = page === 'today' && !(hasWatch && t.readiness)
  const briefing = withBriefing ? brief.text : null
  const busy = brief.busy

  const tip = useMemo(
    () =>
      pageTip(page, {
        hour: new Date().getHours(),
        kcalEaten: t.kcalEaten,
        kcalTarget: t.kcalTarget,
        proteinEaten: t.proteinEaten,
        proteinTarget: t.proteinTarget,
        waterMl: t.waterMl,
        waterTarget: t.waterTarget,
        trainedToday: t.trainedToday,
        restDay: t.restDay,
        nextWorkout: t.nextWorkout,
        weekDone: t.weekDone,
        weekGoal: t.weekGoal,
        streakWeeks: t.streakWeeks,
        readiness: t.readiness?.score ?? null,
        sleepMin: t.sleep?.asleep_min ?? null,
        restingHr: t.restingHr,
        restingHrNormal: hasWatch ? baseline(daily ?? [], 'resting_hr', t.day) : null,
        friends: showSocial ? (board ?? []).filter((f) => f.user_id !== user?.id).length : 0,
        showNutrition,
        hasWatch,
        hardShare: null,
      }),
    [page, t, daily, board, user, showNutrition, showSocial, hasWatch],
  )

  if (t.loading || !tip || hidden || hiddenToday(tip.key, t.day)) return null
  const aiOn = !!ai?.enabled

  return (
    <section className="anim-fade flex gap-3 rounded-2xl bg-cream p-3.5" style={style} aria-label="Tipp von Buddy">
      <button
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10"
        onClick={() => openBuddySheet()}
        aria-label="Buddy öffnen"
      >
        <BuddyFace size={36} mood={busy ? 'focus' : tip.mood} stage={buddy.stage} skin={buddy.skin} />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-snug">{briefing ?? tip.text}</p>
        <div className="flex flex-wrap gap-1.5">
          {tip.action && (
            <button
              className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand active:scale-95"
              onClick={() => navigate(tip.action!.to)}
            >
              {tip.action.label}
            </button>
          )}
          {aiOn && withBriefing && !briefing && (
            <button
              className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-on-brand active:scale-95"
              onClick={() => void brief.load()}
              disabled={busy}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Tagesbriefing
            </button>
          )}
          {aiOn && tip.ask && (
            <button
              className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs font-semibold text-cocoa active:scale-95"
              onClick={() => openBuddySheet(tip.ask)}
            >
              <Sparkles size={12} className="text-brand" /> Frag Buddy
            </button>
          )}
        </div>
      </div>
      <button
        className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-cocoa-muted"
        aria-label="Tipp für heute ausblenden"
        onClick={() => {
          hideToday(tip.key, t.day)
          setHidden(true)
        }}
      >
        <X size={15} />
      </button>
    </section>
  )
}
