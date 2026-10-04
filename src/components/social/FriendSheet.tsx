import { useState } from 'react'
import { Check, Hand, Send } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { useGiveKudos, useSendPoke } from '../../hooks/useSocial'
import { effectiveMonthlyPrs, effectiveProteinDays, effectiveSessions } from '../../lib/duel'
import { RingAvatar } from './Avatar'
import { avatarEmoji, firstName, proteinToday, statusLine, type Person } from './format'

const PRESETS = ['Heute Gym? 💪', 'Kommst du mit?', 'Wo bleibst du? 😄']

/** Detail-Sheet zu einer Person: Level, „Du vs. Name", Anstupsen & Kudos. */
export function FriendSheet({
  person,
  me,
  today,
  showNutrition,
  kudosGiven,
  onClose,
}: {
  person: Person
  me: Person
  today: string
  showNutrition: boolean
  kudosGiven: boolean
  onClose: () => void
}) {
  const isMe = person.user_id === me.user_id
  const name = isMe ? 'Du' : firstName(person)
  const sendPoke = useSendPoke()
  const giveKudos = useGiveKudos()
  const [text, setText] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const st = statusLine(person, today)
  // Eigene Zahl ist lokal frisch; bei Freunden nur, wenn sie von heute stammt.
  const protein = (u: Person) => (u.user_id === me.user_id ? Math.round(u.protein_today ?? 0) : proteinToday(u, today))

  const rows: { label: string; get: (u: Person) => number; unit?: string }[] = [
    { label: 'Trainings diese Woche', get: (u) => effectiveSessions(u, today) },
    { label: 'Trainings gesamt', get: (u) => u.total_sessions ?? 0 },
    { label: 'Streak (Wochen)', get: (u) => u.week_streak ?? 0 },
    { label: 'Rekorde diesen Monat', get: (u) => effectiveMonthlyPrs(u, today) },
    ...(showNutrition
      ? [
          { label: 'Protein-Tage (Woche)', get: (u: Person) => effectiveProteinDays(u, today) },
          { label: 'Protein heute', get: protein, unit: ' g' },
        ]
      : []),
  ]

  const presets = [
    ...PRESETS,
    ...(showNutrition && !isMe ? [`😂 Nur ${protein(person)} g Protein heute? Schwach!`] : []),
  ]

  function poke(t: string) {
    const msg = t.trim()
    if (!msg) return
    sendPoke.mutate(
      { toUser: person.user_id, text: msg },
      {
        onSuccess: () => {
          setSent(msg)
          setText('')
        },
      },
    )
  }

  return (
    <Sheet title={isMe ? 'Deine Woche' : name} onClose={onClose}>
      <div className="flex flex-col items-center gap-2 pb-1 text-center">
        <RingAvatar
          emoji={avatarEmoji(person, isMe)}
          name={person.display_name}
          sessions={effectiveSessions(person, today)}
          size={96}
          innerClassName="bg-sand"
        />
        <div>
          <div className="text-lg font-bold">{isMe ? firstName(person) : name}</div>
          <div className="text-sm text-cocoa-light">
            Level {person.level ?? 1}
            {person.rank_title ? ` · ${person.rank_title}` : ''}
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-1 text-xs text-cocoa-muted">
            {st.kind === 'trained' && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
            {st.text}
          </div>
        </div>
      </div>

      {/* Kennzahlen: Du vs. Name */}
      <div className="rounded-2xl bg-sand-light p-3 ring-1 ring-sand-dark/50">
        {!isMe && (
          <div className="grid grid-cols-[1fr_4rem_4rem] pb-1.5 text-xs font-semibold text-cocoa-muted">
            <span />
            <span className="text-right text-brand">Du</span>
            <span className="truncate text-right">{name}</span>
          </div>
        )}
        <div className="divide-y divide-sand-dark/40">
          {rows.map((r) => {
            const a = r.get(me)
            const b = r.get(person)
            return (
              <div
                key={r.label}
                className={`tabular grid items-center py-1.5 text-sm ${
                  isMe ? 'grid-cols-[1fr_4rem]' : 'grid-cols-[1fr_4rem_4rem]'
                }`}
              >
                <span className="text-cocoa-light">{r.label}</span>
                <span className={`text-right ${!isMe && a > b ? 'font-bold' : 'font-medium'}`}>
                  {a}
                  {r.unit}
                </span>
                {!isMe && (
                  <span className={`text-right ${b > a ? 'font-bold' : 'font-medium'}`}>
                    {b}
                    {r.unit}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {!isMe && (
        <>
          {/* Anstupsen */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-cocoa-light">Anstupsen</div>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  className="rounded-full bg-sand px-3 py-1.5 text-sm text-cocoa-light transition-colors disabled:opacity-50"
                  onClick={() => poke(p)}
                  disabled={sendPoke.isPending}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input py-2 text-sm"
                placeholder={`Nachricht an ${name}…`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && poke(text)}
                aria-label="Eigene Nachricht"
              />
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40"
                onClick={() => poke(text)}
                disabled={!text.trim() || sendPoke.isPending}
                aria-label="Senden"
              >
                <Send size={16} />
              </button>
            </div>
            {sent && (
              <p className="anim-fade flex items-center gap-1 text-xs font-semibold text-success">
                <Check size={14} strokeWidth={3} />
                Gesendet: „{sent}"
              </p>
            )}
          </div>

          {/* Kudos */}
          <button
            className="btn-ghost w-full gap-2 disabled:opacity-50"
            onClick={() => giveKudos.mutate(person.user_id)}
            disabled={kudosGiven || giveKudos.isPending}
          >
            {kudosGiven ? <Check size={18} className="text-success" /> : <Hand size={18} />}
            {kudosGiven ? 'Kudos gegeben' : 'Kudos geben'}
          </button>
        </>
      )}
    </Sheet>
  )
}
