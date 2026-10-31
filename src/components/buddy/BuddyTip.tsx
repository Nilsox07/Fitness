import { useEffect, useMemo, type CSSProperties } from 'react'
import { useToday } from '../../hooks/useToday'
import { useHealthDaily } from '../../hooks/useHealth'
import { useLeaderboard } from '../../hooks/useSocial'
import { useAuth } from '../../lib/auth'
import { usePrefs } from '../../lib/prefs'
import { baseline } from '../../lib/health'
import { pageTip, type Tip, type TipPage } from '../../lib/buddyTips'
import { useAiGate } from '../../hooks/usePremium'
import { setTipPage } from '../../lib/buddyFloat'

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

/** Seite meldet ihren Tipp an – angezeigt wird er vom schwebenden Buddy (Sprechblase). */
export function BuddyTip({ page }: { page: TipPage; style?: CSSProperties }) {
  useEffect(() => {
    setTipPage(page)
    return () => setTipPage(null)
  }, [page])
  return null
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
          })
        : null,
    [page, t, daily, board, user, showNutrition, showSocial, hasWatch, gate.canUse],
  )
  return { tip, day: t.day, loading: t.loading }
}
