import type { CSSProperties } from 'react'
import { Handshake } from 'lucide-react'
import { useAnswerChallenge } from '../../hooks/useChallenges'
import { CHALLENGE_KINDS, outcome, outcomeText, weekEnd, type Challenge } from '../../lib/stakes'
import { daysBetween } from './format'

/** Karussell-Karte einer Wette: offen (annehmen/ablehnen), laufend (Du vs. Freund) oder Ergebnis. */
export function StakeCard({
  c,
  meId,
  friendName,
  today,
  style,
}: {
  c: Challenge
  meId: string
  friendName: string
  today: string
  style?: CSSProperties
}) {
  const answer = useAnswerChallenge()
  const iAmCreator = c.creator === meId
  const mine = iAmCreator ? c.creator_value : c.opponent_value
  const theirs = iAmCreator ? c.opponent_value : c.creator_value
  const unit = CHALLENGE_KINDS.find((k) => k.kind === c.kind)?.unit ?? ''
  const res = c.status === 'active' ? outcome(c, meId, today) : 'running'
  // wie „noch X Tage“ im Wochenkopf: Tage nach heute
  const left = Math.max(0, daysBetween(today, weekEnd(c.week_start)))

  const bar = (label: string, v: number, highlight: boolean) => (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className={`font-semibold ${highlight ? 'text-brand' : ''}`}>{label}</span>
        <span className="tabular text-bg/70 dark:text-cocoa-light">
          {Math.min(v, c.target)}/{c.target}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg/15 dark:bg-sand-dark/45">
        <div
          className={`h-full rounded-full ${v >= c.target ? 'bg-success' : 'bg-brand'}`}
          style={{ width: `${Math.min(100, (v / c.target) * 100)}%` }}
        />
      </div>
    </div>
  )

  return (
    <section
      className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={style}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-gold/25 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            <Handshake size={14} className="text-gold" /> Wette
          </span>
          <span className="tabular rounded-full bg-bg/10 px-2.5 py-1 text-xs font-semibold dark:bg-white/5">
            {res !== 'running'
              ? 'Ergebnis'
              : left === 0
                ? 'letzter Tag'
                : `noch ${left} ${left === 1 ? 'Tag' : 'Tage'}`}
          </span>
        </div>
        <h2 className="mt-2 text-xl font-bold leading-tight">
          {c.target} {unit} – Einsatz: {c.stake}
        </h2>
      </div>

      {c.status === 'pending' ? (
        <div className="relative space-y-3">
          <p className="text-sm text-bg/75 dark:text-cocoa-light">
            {iAmCreator
              ? `Wartet darauf, dass ${friendName} annimmt.`
              : `${friendName} fordert dich heraus: Wer bis Sonntag keine ${c.target} ${unit} schafft, schuldet ${c.stake}.`}
          </p>
          {!iAmCreator && (
            <div className="flex gap-2">
              <button
                className="btn flex-1 bg-bg/10 text-bg dark:bg-white/5 dark:text-cocoa"
                onClick={() => answer.mutate({ id: c.id, accept: false })}
                disabled={answer.isPending}
              >
                Ablehnen
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => answer.mutate({ id: c.id, accept: true })}
                disabled={answer.isPending}
              >
                Annehmen
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative space-y-3">
          {bar('Du', mine, true)}
          {bar(friendName, theirs, false)}
          {res !== 'running' && (
            <p className="rounded-2xl bg-bg/10 p-3 text-sm font-semibold dark:bg-white/5">
              {outcomeText(res, c.stake, friendName)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
