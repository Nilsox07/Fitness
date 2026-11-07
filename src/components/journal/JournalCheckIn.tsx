// Journal-Check-in: Wie ausgeruht bist du heute? + Was war gestern/heute? (Chips zum Antippen)
// Jeder Tipp speichert sofort. „Nichts davon“ zählt auch – so lernt der Vergleich die Tage ohne.

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useJournal, useSaveJournal } from '../../hooks/useJournal'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { localDate, shiftDate } from '../../lib/day'
import { FEEL_LABEL, defaultJournalDay, habitLabel, trackedHabits, type JournalEntry } from '../../lib/journal'

const chip = (on: boolean) =>
  `rounded-full px-3 py-2 text-sm font-semibold transition active:scale-95 ${
    on ? 'bg-brand text-white' : 'bg-sand text-cocoa-light'
  }`

export function JournalCheckIn({ compact = false }: { compact?: boolean }) {
  const today = localDate()
  const yesterday = shiftDate(today, -1)
  const { data: entries = [] } = useJournal()
  const save = useSaveJournal()
  const { prefs } = useUserPrefs()
  const [day, setDay] = useState(() => defaultJournalDay(today, new Date().getHours()))
  const habits = trackedHabits(prefs.journalHabits)

  const entryOf = (d: string): JournalEntry | null => entries.find((e) => e.date === d) ?? null
  const cur = entryOf(day)
  const todayEntry = entryOf(today)
  const feel = todayEntry?.feel ?? null

  const write = (d: string, patch: Partial<JournalEntry>) => {
    const base = entryOf(d) ?? { date: d, tags: [], feel: null }
    save.mutate({ ...base, ...patch, date: d })
  }
  const toggle = (id: string) => {
    const tags = cur?.tags ?? []
    write(day, { tags: tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id] })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Wie ausgeruht bist du heute?</p>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Wie ausgeruht">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={feel === v}
              onClick={() => write(today, { feel: feel === v ? null : v })}
              className={`flex flex-col items-center rounded-xl py-2 transition active:scale-95 ${
                feel === v ? 'bg-brand text-white' : 'bg-sand text-cocoa-light'
              }`}
            >
              <span className="tabular text-base font-bold leading-none">{v}</span>
              <span className="mt-1 text-[10px] font-semibold leading-none">{FEEL_LABEL[v]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Was war {day === today ? 'heute' : 'gestern'}?</p>
          <div className="flex rounded-full bg-sand p-0.5 text-xs font-semibold">
            {[
              [yesterday, 'Gestern'],
              [today, 'Heute'],
            ].map(([d, l]) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                aria-pressed={day === d}
                className={`rounded-full px-3 py-1 ${day === d ? 'bg-cream text-cocoa shadow-sm' : 'text-cocoa-muted'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {habits.map((id) => (
            <button
              key={id}
              onClick={() => toggle(id)}
              aria-pressed={!!cur?.tags.includes(id)}
              className={chip(!!cur?.tags.includes(id))}
            >
              {habitLabel(id)}
            </button>
          ))}
          <button
            onClick={() => write(day, { tags: [] })}
            aria-pressed={!!cur && cur.tags.length === 0}
            className={chip(!!cur && cur.tags.length === 0)}
          >
            Nichts davon
          </button>
        </div>
        {!compact && cur && (
          <p className="mt-2 flex items-center gap-1 text-xs text-cocoa-muted">
            <Check size={13} /> Gespeichert
          </p>
        )}
      </div>
    </div>
  )
}
