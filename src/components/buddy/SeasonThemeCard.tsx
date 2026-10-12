import type { CSSProperties } from 'react'
import { Check, Gift } from 'lucide-react'
import { useSeason } from '../../hooks/useSeason'
import { seasonDaysLeft } from '../../lib/seasonTheme'

/** Monats-Saison: KI-Thema, 3 Saison-Quests und das exklusive Abzeichen als Belohnung. */
export function SeasonThemeCard({ style, compact = false }: { style?: CSSProperties; compact?: boolean }) {
  const { theme, progress, earned } = useSeason()
  if (!theme || !progress) return null
  const month = new Date(`${theme.id}-15T12:00:00`).toLocaleDateString('de-DE', { month: 'long' })
  const left = seasonDaysLeft()
  const doneCount = progress.quests.filter((q) => q.done).length

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={style}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            Saison {month}
          </span>
          <span className="tabular rounded-full bg-bg/10 px-2 py-0.5 text-[11px] font-semibold dark:bg-white/5">
            {earned ? 'Geschafft' : `noch ${left} ${left === 1 ? 'Tag' : 'Tage'}`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-bg/10 text-2xl dark:bg-white/5">
            {theme.emoji}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold leading-tight">{theme.name}</h2>
            {!compact && <p className="text-sm leading-snug text-bg/70 dark:text-cocoa-light">{theme.tagline}</p>}
          </div>
        </div>

        <ul className="mt-4 space-y-2.5">
          {progress.quests.map((q) => (
            <li key={q.type + (q.muscle ?? '')} className="flex items-center gap-3">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  q.done ? 'bg-success text-white' : 'ring-2 ring-inset ring-bg/25 dark:ring-sand-dark'
                }`}
              >
                {q.done && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={`truncate font-semibold ${q.done ? 'opacity-70' : ''}`}>{q.label}</span>
                  <span className="tabular shrink-0 text-xs text-bg/60 dark:text-cocoa-light">
                    {q.type === 'volume'
                      ? `${Math.round(q.value / 1000)}/${Math.round(q.target / 1000)} t`
                      : `${Math.min(q.value, q.target)}/${q.target}`}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-bg/15 dark:bg-sand-dark/45">
                  <span
                    className={`block h-full rounded-full ${q.done ? 'bg-success' : 'bg-brand'}`}
                    style={{ width: `${q.pct}%` }}
                  />
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-bg/10 p-2.5 dark:bg-white/5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-lg">
            {theme.badge.emoji}
          </span>
          <span className="min-w-0 flex-1 text-xs leading-snug">
            <span className="block font-semibold">
              {earned ? 'Abzeichen verdient: ' : 'Belohnung: '}
              {theme.badge.label}
            </span>
            <span className="text-bg/60 dark:text-cocoa-light">
              {earned ? 'Trag es in der Garderobe als Anstecker.' : `Nur im ${month} – ${doneCount}/3 Quests erledigt`}
            </span>
          </span>
          <Gift size={16} className="shrink-0 text-gold" />
        </div>
      </div>
    </section>
  )
}
