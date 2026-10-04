import { useState } from 'react'
import { Crown, Info } from 'lucide-react'
import { DUEL_POINTS, WEEKLY_GOAL, type DuelStandings } from '../../lib/duel'
import { useBuddySkin } from '../buddy/useBuddy'
import { Avatar } from './Avatar'
import { buddyLook, firstName, type Person } from './format'

/** Wochen-Duell (Apple-Fitness-Wettkampf-Stil): Punkte, Verhältnis-Balken, Aufschlüsselung. */
export function DuelCard({
  people,
  meId,
  standings,
  includeProtein,
}: {
  /** Reihenfolge wie in `standings.scores` */
  people: Person[]
  meId: string
  standings: DuelStandings
  includeProtein: boolean
}) {
  const [info, setInfo] = useState(false)
  const mySkin = useBuddySkin()
  const { scores, leaderId, lead, sum } = standings
  const name = (u: Person) => (u.user_id === meId ? 'Du' : firstName(u))
  const leader = people.find((u) => u.user_id === leaderId)
  const cols = people.length

  const headline = leader
    ? leader.user_id === meId
      ? `Du führst mit ${lead} P Vorsprung`
      : `${firstName(leader)} führt mit ${lead} P`
    : sum > 0
      ? 'Gleichstand an der Spitze'
      : 'Noch keine Punkte — wer legt vor?'

  const rows: { label: string; value: (i: number) => string }[] = [
    { label: 'Trainings', value: (i) => `${scores[i].sessions}` },
    { label: `Ziel ${WEEKLY_GOAL}×`, value: (i) => (scores[i].goal ? `+${scores[i].goal}` : '–') },
    ...(includeProtein ? [{ label: 'Protein-Tage', value: (i: number) => `${scores[i].proteinDays}` }] : []),
  ]
  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">Wochen-Duell</h3>
          <p className="text-sm text-cocoa-light">{headline}</p>
        </div>
        <button
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            info ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
          }`}
          onClick={() => setInfo((v) => !v)}
          aria-expanded={info}
        >
          <Info size={13} />
          So zählt's
        </button>
      </div>

      {info && (
        <ul className="anim-fade space-y-1 rounded-xl bg-sand px-3 py-2.5 text-sm text-cocoa-light">
          <li>
            <strong className="text-cocoa">{DUEL_POINTS.training} P</strong> pro Training diese Woche
          </li>
          <li>
            <strong className="text-cocoa">+{DUEL_POINTS.goal} P</strong> Bonus ab {WEEKLY_GOAL} Trainings
          </li>
          {includeProtein && (
            <li>
              <strong className="text-cocoa">{DUEL_POINTS.protein} P</strong> pro Tag mit erreichtem
              Protein-Ziel
            </li>
          )}
          <li className="pt-1 text-xs text-cocoa-muted">
            Zählt Mo–So, startet jeden Montag neu. Nur Summen werden geteilt.
          </li>
        </ul>
      )}

      {/* Personen + Punkte */}
      <div
        className={`grid items-center gap-2 ${cols === 2 ? 'grid-cols-[1fr_auto_1fr]' : ''}`}
        style={cols === 2 ? undefined : grid}
      >
        {people.map((u, i) => {
          const isMe = u.user_id === meId
          return (
            <div
              key={u.user_id}
              className="flex min-w-0 flex-col items-center text-center"
              style={cols === 2 ? { gridColumn: i === 0 ? 1 : 3, gridRow: 1 } : undefined}
            >
              <div className="relative">
                <Avatar buddy={buddyLook(u, isMe, mySkin)} name={u.display_name} size={40} />
                {u.user_id === leaderId && (
                  <Crown
                    size={18}
                    className="absolute -right-2 -top-2 rotate-12 fill-gold text-gold"
                    aria-label="Führt"
                  />
                )}
              </div>
              <div className={`mt-1 w-full truncate text-sm font-semibold ${isMe ? 'text-brand' : ''}`}>
                {name(u)}
              </div>
              <div className="tabular text-3xl font-bold leading-none">
                {scores[i].total}
                <span className="ml-0.5 text-sm font-semibold text-cocoa-light">P</span>
              </div>
            </div>
          )
        })}
        {cols === 2 && (
          <span
            className="w-24 text-center text-xs font-semibold uppercase tracking-wide text-cocoa-muted"
            style={{ gridColumn: 2, gridRow: 1 }}
          >
            vs
          </span>
        )}
      </div>

      {/* Verhältnis-Balken */}
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-sand" aria-hidden>
        {sum > 0 &&
          scores.map((s) =>
            s.total > 0 ? (
              <div
                key={s.user_id}
                className={`h-full transition-[width] duration-500 ${
                  s.user_id === leaderId ? 'bg-brand' : 'bg-sand-dark'
                }`}
                style={{ width: `${(s.total / sum) * 100}%` }}
              />
            ) : null,
          )}
      </div>

      {/* Aufschlüsselung */}
      <div className="space-y-1.5 border-t border-sand-dark/40 pt-3">
        {rows.map((r) =>
          cols === 2 ? (
            <div key={r.label} className="tabular grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
              <span className="text-center font-semibold">{r.value(0)}</span>
              <span className="w-24 text-center text-xs text-cocoa-muted">{r.label}</span>
              <span className="text-center font-semibold">{r.value(1)}</span>
            </div>
          ) : (
            <div key={r.label}>
              <div className="text-center text-[11px] font-medium text-cocoa-muted">{r.label}</div>
              <div className="tabular grid gap-2 text-center text-sm font-semibold" style={grid}>
                {people.map((u, i) => (
                  <span key={u.user_id}>{r.value(i)}</span>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
