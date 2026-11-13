import { BuddyLine, HeroWithBuddy } from '../home/HeroBuddy'
import { useHeroBuddy } from '../home/useHeroBuddy'
import { useBriefing } from '../buddy/useBriefing'
import { enter } from '../home/motion'
import { HeroPill } from '../health/ui'
import { PlusBadge } from '../premium/PlusBadge'
import { useToday } from '../../hooks/useToday'
import { usePrefs } from '../../lib/prefs'
import { fmtInt } from '../../lib/nutritionHome'

/**
 * Kopf von „Heute“: Buddy sitzt auf der großen Karte, sein Spruch (bzw. das Tagesbriefing) oben.
 * Darunter die drei wichtigsten Zahlen. Eintragen passiert in „Jetzt dran“ darunter.
 */
export function TodayHero() {
  const t = useToday()
  const { showNutrition, hasWatch } = usePrefs()
  const brief = useBriefing()
  const tipBuddy = useHeroBuddy('today')

  // Spruch: Tagesbriefing (Plus: nach Antippen; kostenlos: fester Text), sonst der Seiten-Tipp
  const hasBrief = !!brief.text
  const buddy = {
    ...tipBuddy,
    mood: brief.busy ? ('focus' as const) : tipBuddy.mood,
    line: brief.busy ? 'Ich schau mir deinen Tag an …' : hasBrief ? brief.text! : tipBuddy.line,
    onLine:
      !hasBrief && (brief.aiOn || brief.locked)
        ? () => void brief.load()
        : brief.locked && hasBrief
          ? () => void brief.load()
          : tipBuddy.onLine,
  }

  const pills: { value: string; label: string }[] = []
  if (hasWatch && t.readiness) pills.push({ value: String(t.readiness.score), label: 'Tagesform' })
  if (showNutrition && t.kcalTarget > 0) {
    const left = t.kcalTarget - t.kcalEaten
    pills.push({ value: fmtInt(Math.abs(left)), label: left >= 0 ? 'kcal übrig' : 'kcal drüber' })
  }
  pills.push({ value: `${t.weekDone}/${t.weekGoal}`, label: 'Trainings' })
  if (pills.length < 3)
    pills.push({ value: String(t.streakWeeks), label: t.streakWeeks === 1 ? 'Woche Serie' : 'Wochen Serie' })

  return (
    <div style={enter(1)}>
      <HeroWithBuddy buddy={buddy}>
        <section className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative">
            <BuddyLine line={buddy.line} tone="dark" onClick={buddy.onLine} long />
            {!hasBrief && brief.locked && (
              <p className="-mt-2 mb-3 flex items-center gap-1.5 text-[11px] text-bg/60 dark:text-cocoa-light">
                Tippen für dein Tagesbriefing <PlusBadge onDark />
              </p>
            )}
            <div className={`grid gap-2 ${pills.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {pills.slice(0, 3).map((p) => (
                <HeroPill key={p.label} value={p.value} label={p.label} />
              ))}
            </div>
          </div>
        </section>
      </HeroWithBuddy>
    </div>
  )
}
