import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, Drumstick, Flame, Hand, Medal, Trophy } from 'lucide-react'
import { effectiveMonthlyPrs, effectiveProteinDays, effectiveWeeklyVolume } from '../../lib/duel'
import { useBuddySkin } from '../buddy/useBuddy'
import { shortName, type FeedWorld } from '../community/communityUtils'
import { Avatar } from './Avatar'
import { buddyLook, proteinToday, type Person } from './format'

// Reihenfolge = faire Kennzahlen zuerst; Volumen (kraftabhängig) zuletzt.
type FitnessMetric = 'monthly_prs' | 'total_sessions' | 'week_streak' | 'level' | 'weekly_volume'
type FoodMetric = 'protein_days' | 'protein_today' | 'level'
type Metric = FitnessMetric | FoodMetric

const FITNESS: { id: FitnessMetric; label: string }[] = [
  { id: 'monthly_prs', label: 'Fortschritt' },
  { id: 'total_sessions', label: 'Trainings' },
  { id: 'week_streak', label: 'Streak' },
  { id: 'level', label: 'Level' },
  { id: 'weekly_volume', label: 'Volumen' },
]
const FOOD: { id: FoodMetric; label: string }[] = [
  { id: 'protein_days', label: 'Eiweiß-Tage' },
  { id: 'protein_today', label: 'Eiweiß heute' },
  { id: 'level', label: 'Level' },
]

/** Aufklappbare Bestenliste — Kennzahlen passend zur Welt (Training bzw. Ernährung). */
export function LeaderboardSection({
  people,
  meId,
  today,
  world = 'fitness',
  kudosReceived,
  kudosGiven,
  onKudos,
  style,
}: {
  /** Du (lokal frische Zahlen) + Freunde */
  people: Person[]
  meId: string
  today: string
  world?: FeedWorld
  kudosReceived: Map<string, number>
  kudosGiven: Set<string>
  onKudos: (userId: string) => void
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const mySkin = useBuddySkin()
  const options = world === 'food' ? FOOD : FITNESS
  const [picked, setPicked] = useState<Metric | null>(null)
  const metric: Metric = picked && options.some((o) => o.id === picked) ? picked : options[0].id

  const value = useMemo(
    () =>
      (u: Person): number => {
        const isMe = u.user_id === meId
        switch (metric) {
          // Wochen-/Monatswerte nur, wenn sie aus dem aktuellen Zeitraum stammen.
          case 'weekly_volume':
            return effectiveWeeklyVolume(u, today)
          case 'monthly_prs':
            return effectiveMonthlyPrs(u, today)
          case 'protein_days':
            return isMe ? Math.round(u.protein_week ?? 0) : effectiveProteinDays(u, today)
          case 'protein_today':
            return isMe ? Math.round(u.protein_today ?? 0) : proteinToday(u, today)
          default:
            return (u[metric] as number) ?? 0
        }
      },
    [metric, meId, today],
  )
  const ranked = useMemo(() => [...people].sort((a, b) => value(b) - value(a)), [people, value])

  function display(u: Person) {
    const v = value(u)
    switch (metric) {
      case 'monthly_prs':
        return (
          <span className="inline-flex items-center gap-1">
            {v}
            <Trophy size={14} className="text-gold" />
          </span>
        )
      case 'level':
        return `Lvl ${v || 1}`
      case 'weekly_volume':
        return `${v.toLocaleString('de-DE')} kg`
      case 'week_streak':
        return (
          <span className="inline-flex items-center gap-1">
            <Flame size={14} className="text-brand" />
            {v}
          </span>
        )
      case 'protein_days':
        return `${v}/7`
      case 'protein_today':
        return `${v} g`
      default:
        return `${v}`
    }
  }

  const sub = (u: Person) =>
    world === 'food'
      ? `Level ${u.level ?? 1}`
      : `${u.rank_title ? `${u.rank_title} · ` : ''}${u.total_sessions ?? 0} Trainings`

  return (
    <section className="space-y-3" style={style}>
      <button
        className="card flex w-full items-center gap-3 py-3.5 text-left transition active:scale-[0.99]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
          {world === 'food' ? <Drumstick size={16} /> : <Medal size={17} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Bestenliste</span>
          <span className="block truncate text-xs text-cocoa-light">
            {world === 'food' ? 'Eiweiß-Tage, Eiweiß heute, Level' : 'Fortschritt, Trainings, Streak, Level, Volumen'}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-cocoa-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="anim-fade space-y-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {options.map((m) => (
              <button
                key={m.id}
                onClick={() => setPicked(m.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  metric === m.id ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
                }`}
                aria-pressed={metric === m.id}
              >
                {m.label}
              </button>
            ))}
          </div>
          {world === 'fitness' && (
            <p className="px-1 text-xs text-cocoa-muted">
              Fair vergleichen: <strong>Fortschritt</strong> (neue Bestleistungen/Monat) &amp;{' '}
              <strong>Trainings</strong> zählen für alle gleich — Volumen hängt vom Kraftniveau ab.
            </p>
          )}
          <ol className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
            {ranked.map((u, i) => {
              const me = u.user_id === meId
              const kudos = kudosReceived.get(u.user_id)
              return (
                <li key={u.user_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="tabular grid w-5 place-items-center text-sm font-bold text-cocoa-muted">
                    {i === 0 && value(u) > 0 ? <Medal size={18} className="text-gold" aria-label="Platz 1" /> : i + 1}
                  </span>
                  <Avatar buddy={buddyLook(u, me, mySkin, today)} name={u.display_name} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-semibold ${me ? 'text-brand' : ''}`}>
                      {me ? 'Du' : shortName(u.display_name, 'Athlet')}
                    </div>
                    <div className="tabular flex items-center gap-x-1 truncate text-xs text-cocoa-light">
                      {sub(u)}
                      {kudos ? (
                        <span className="inline-flex items-center gap-1">
                          · <Hand size={12} /> {kudos}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="tabular text-right text-sm font-semibold">{display(u)}</div>
                  {!me && (
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light transition duration-200 active:scale-90 disabled:opacity-40"
                      onClick={() => onKudos(u.user_id)}
                      disabled={kudosGiven.has(u.user_id)}
                      aria-label="Kudos geben"
                    >
                      <Hand size={16} />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
