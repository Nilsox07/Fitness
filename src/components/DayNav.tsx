import { useRef } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { dayLabel, localDate, shiftDate } from '../lib/day'

/** Tag wechseln: ‹ Heute › — Tipp auf das Datum öffnet den Kalender. Keine Zukunft. */
export function DayNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = localDate()
  const picker = useRef<HTMLInputElement>(null)
  const isToday = date >= today
  const btn = 'grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa transition-opacity duration-200'

  return (
    <div className="flex items-center gap-1.5">
      <button className={btn} onClick={() => onChange(shiftDate(date, -1))} aria-label="Vorheriger Tag">
        <ChevronLeft size={18} />
      </button>
      <button
        className="relative flex h-9 items-center gap-1.5 rounded-full bg-sand px-3 text-sm font-semibold"
        onClick={() => {
          const el = picker.current
          if (!el) return
          try {
            el.showPicker()
          } catch {
            el.focus()
          }
        }}
      >
        <CalendarDays size={16} className="text-cocoa-light" />
        {dayLabel(date, today)}
        <input
          ref={picker}
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="pointer-events-none absolute inset-0 opacity-0"
          tabIndex={-1}
          aria-hidden
        />
      </button>
      <button
        className={`${btn} ${isToday ? 'pointer-events-none opacity-30' : ''}`}
        onClick={() => onChange(shiftDate(date, 1))}
        aria-label="Nächster Tag"
        disabled={isToday}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
