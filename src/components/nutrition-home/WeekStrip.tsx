import { WeekPicker } from '../ui/WeekPicker'

/**
 * Wochenleiste Mo–So: je Tag ein kleiner Ring mit dem Kalorienfortschritt.
 * Ausgewählter Tag als Pille, Zukunft deaktiviert, Pfeile springen wochenweise.
 */
export function WeekStrip({
  date,
  today,
  onChange,
  kcalByDate,
  targetFor,
  maxDate,
}: {
  date: string
  today: string
  onChange: (d: string) => void
  kcalByDate: Map<string, number>
  targetFor: (d: string) => number
  maxDate?: string
}) {
  return (
    <WeekPicker
      date={date}
      today={today}
      onChange={onChange}
      maxDate={maxDate}
      progressFor={(d) => {
        const target = targetFor(d)
        return target > 0 ? (kcalByDate.get(d) ?? 0) / target : 0
      }}
    />
  )
}
