import { useState, type CSSProperties } from 'react'
import { Check, ChevronRight, Sparkles } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { Ring } from '../nutrition-home/Ring'
import { MyBuddy } from './MyBuddy'
import { useBuddyLevel } from './useBuddy'
import { useQuests } from '../../hooks/useQuests'
import type { Quest } from '../../lib/xp'

/**
 * Schmale Buddy-Leiste unter der Überschrift (Training & Ernährung): Level, XP und
 * wie viele Tagesquests erledigt sind. Tippen öffnet alle Quests.
 */
export function QuestStrip({ area, style }: { area: 'training' | 'food'; style?: CSSProperties }) {
  const lvl = useBuddyLevel()
  const quests = useQuests()
  const [open, setOpen] = useState(false)
  const set = area === 'food' && quests.food ? quests.food : quests.training
  const done = set.daily.filter((q) => q.done).length
  const xpToday = set.daily.filter((q) => q.done).reduce((a, q) => a + q.xp, 0)
  const pct = lvl.progress / 100

  return (
    <>
      <button
        className="flex w-full items-center gap-3 rounded-2xl bg-cream px-3 py-2.5 text-left transition active:scale-[0.99]"
        onClick={() => setOpen(true)}
        style={style}
        aria-label={`Buddy Level ${lvl.level}, ${done} von ${set.daily.length} Tagesquests erledigt`}
      >
        <Ring size={40} stroke={3.5} progress={pct} trackClass="stroke-sand-dark/45">
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-sand">
            <MyBuddy size={30} />
          </span>
        </Ring>
        <span className="min-w-0 flex-1">
          <span className="tabular block text-sm font-bold">
            Level {lvl.level}
            <span className="ml-1.5 font-medium text-cocoa-light">
              {lvl.xpInLevel}/{lvl.xpForLevel} XP
            </span>
          </span>
          <span className="mt-1 flex gap-1" aria-hidden>
            {set.daily.map((q) => (
              <span key={q.id} className={`h-1.5 flex-1 rounded-full ${q.done ? 'bg-success' : 'bg-sand-dark/50'}`} />
            ))}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="tabular text-sm font-bold">
            {done}/{set.daily.length}
          </span>
          <span className="text-[11px] text-cocoa-light">Quests heute</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
      </button>

      {open && (
        <PremiumSheet
          title="Buddy-Quests"
          subtitle={xpToday > 0 ? `Heute schon +${xpToday} XP` : 'Jede Quest bringt XP – Buddy wächst mit'}
          leading={
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <Sparkles size={18} />
            </span>
          }
          onClose={() => setOpen(false)}
        >
          <div className="rounded-2xl bg-cream p-3.5">
            <div className="flex items-baseline justify-between">
              <span className="font-bold">Buddy-Level {lvl.level}</span>
              <span className="tabular text-xs text-cocoa-light">
                noch {Math.max(0, lvl.xpForLevel - lvl.xpInLevel)} XP bis Level {lvl.level + 1}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-dark/40">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
          </div>
          {quests.food && <QuestGroup title="Ernährung · heute" quests={quests.food.daily} />}
          <QuestGroup title="Training · heute" quests={quests.training.daily} />
          {quests.food && <QuestGroup title="Ernährung · diese Woche" quests={quests.food.weekly} />}
          <QuestGroup title="Training · diese Woche" quests={quests.training.weekly} />
          <p className="px-1 text-xs leading-snug text-cocoa-muted">
            XP aus Training und Ernährung lassen Buddy aufsteigen – mit neuen Looks und Freischaltungen unter
            Fortschritt → Erfolge.
          </p>
        </PremiumSheet>
      )}
    </>
  )
}

function QuestGroup({ title, quests }: { title: string; quests: Quest[] }) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{title}</h3>
      <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
        {quests.map((q) => (
          <div key={q.id} className="flex items-center gap-3 px-3.5 py-2.5">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                q.done ? 'bg-success text-white' : 'ring-2 ring-inset ring-sand-dark'
              }`}
            >
              {q.done && <Check size={14} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold ${q.done ? 'text-cocoa-light line-through' : ''}`}>
                {q.label}
              </span>
              {!q.done && (
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sand-dark/40">
                  <span className="block h-full rounded-full bg-brand/70" style={{ width: `${q.progress}%` }} />
                </span>
              )}
            </span>
            <span
              className={`tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                q.done ? 'bg-success/15 text-success' : 'bg-gold/15 text-gold'
              }`}
            >
              +{q.xp} XP
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
