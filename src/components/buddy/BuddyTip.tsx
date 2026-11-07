import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, X } from 'lucide-react'
import { MyBuddy } from './MyBuddy'
import { openBuddySheet } from './BuddySheet'
import { useBriefing } from './useBriefing'
import { openPlusSheet } from '../../lib/premium'
import { PlusBadge } from '../premium/PlusBadge'
import { useToday } from '../../hooks/useToday'
import { useHealthDaily } from '../../hooks/useHealth'
import { useLeaderboard } from '../../hooks/useSocial'
import { useAuth } from '../../lib/auth'
import { usePrefs } from '../../lib/prefs'
import { baseline } from '../../lib/health'
import { pageTip, type Tip, type TipPage } from '../../lib/buddyTips'
import { useAiGate } from '../../hooks/usePremium'
import { useSleepPlan } from '../../hooks/useRecovery'

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
 * Buddy oben auf der Seite: ganze Figur mit Sprechblase – ein kurzer Tipp aus deinen Daten,
 * passende Knöpfe und „Frag Buddy“. Für heute wegtippbar. Auf „Heute“ ohne Uhr-Tagesform
 * steckt hier auch das Tagesbriefing (sonst in der Tagesform-Karte).
 */
export function BuddyTip({ page, style }: { page: TipPage; style?: CSSProperties }) {
  const navigate = useNavigate()
  const { tip, day, loading } = usePageTip(page)
  const t = useToday()
  const { hasWatch } = usePrefs()
  const brief = useBriefing()
  const [hidden, setHidden] = useState(false)

  if (loading || !tip || hidden || hiddenToday(tip.key, day)) return null
  const withBriefing = page === 'today' && (brief.aiOn || brief.locked) && !(hasWatch && t.readiness)
  const text = (withBriefing && brief.text) || tip.text

  return (
    <section className="flex items-end gap-1.5" style={style} aria-label="Buddy sagt">
      <button className="relative shrink-0 pb-1" onClick={() => openBuddySheet()} aria-label="Buddy öffnen">
        <span
          className="absolute inset-x-2 bottom-0 h-2 rounded-full bg-black/15 blur-[3px] dark:bg-black/40"
          aria-hidden
        />
        <span className="relative block">
          <MyBuddy size={62} mood={brief.busy ? 'focus' : tip.mood} />
        </span>
      </button>
      <div className="anim-bubble relative min-w-0 flex-1 origin-bottom-left rounded-3xl rounded-bl-md bg-cream p-3.5 pr-9">
        {/* Spitze zeigt auf Buddy */}
        <span className="absolute -left-1.5 bottom-3 h-3.5 w-3.5 rotate-45 bg-cream" aria-hidden />
        <p className="relative text-[14px] leading-snug">{text}</p>
        {(tip.action || withBriefing || ((brief.aiOn || brief.locked) && tip.ask)) && (
          <div className="relative mt-2 flex flex-wrap gap-1.5">
            {tip.action && (
              <button
                className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand active:scale-95"
                onClick={() => navigate(tip.action!.to)}
              >
                {tip.action.label}
              </button>
            )}
            {withBriefing && (brief.locked || !brief.text) && (
              <button
                className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-on-brand active:scale-95"
                onClick={() => void brief.load()}
                disabled={brief.busy}
              >
                {brief.busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {brief.locked ? 'KI-Briefing' : 'Tagesbriefing'}
                {brief.locked && <PlusBadge onDark />}
              </button>
            )}
            {(brief.aiOn || brief.locked) && tip.ask && (
              <button
                className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs font-semibold text-cocoa active:scale-95"
                onClick={() => (brief.locked ? openPlusSheet() : openBuddySheet(tip.ask))}
              >
                <Sparkles size={12} className="text-brand" /> Frag Buddy
                {brief.locked && <PlusBadge />}
              </button>
            )}
          </div>
        )}
        <button
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-cocoa-muted active:bg-sand"
          aria-label="Tipp für heute ausblenden"
          onClick={() => {
            hideToday(tip.key, day)
            setHidden(true)
          }}
        >
          <X size={15} />
        </button>
      </div>
    </section>
  )
}

export function isTipHidden(key: string, day: string): boolean {
  return hiddenToday(key, day)
}
export function hideTip(key: string, day: string): void {
  hideToday(key, day)
}

/** Tipp für eine Seite aus den echten Daten (ohne KI). */
export function usePageTip(page: TipPage | null): { tip: Tip | null; day: string; loading: boolean } {
  const t = useToday()
  const { user } = useAuth()
  const { showNutrition, showSocial, hasWatch } = usePrefs()
  const { data: daily } = useHealthDaily(30)
  const { data: board } = useLeaderboard()
  const gate = useAiGate()
  const plan = useSleepPlan()
  const tip = useMemo(
    () =>
      page
        ? pageTip(page, {
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
            aiPlus: gate.canUse,
            bedAt: plan?.bedAt ?? null,
          })
        : null,
    [page, t, daily, board, user, showNutrition, showSocial, hasWatch, gate.canUse, plan],
  )
  return { tip, day: t.day, loading: t.loading }
}
