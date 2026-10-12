// Supplemente: Einnahme-Plan (Uhrzeiten × Wochentage) und was heute fällig ist.

export interface Supplement {
  id: string
  user_id: string
  name: string
  dose: string
  /** lokale Uhrzeiten „HH:MM“ */
  times: string[]
  /** Wochentage 0 = Mo … 6 = So */
  days: number[]
  remind: boolean
  position: number
  created_at: string
}

export interface SupplementLog {
  supplement_id: string
  date: string
  slot: string
}

export const SUPPLEMENT_PRESETS: { name: string; dose: string; times: string[]; hint: string }[] = [
  { name: 'Kreatin', dose: '5 g', times: ['08:00'], hint: 'Täglich, Zeitpunkt egal' },
  { name: 'Vitamin D3', dose: '2000 IE', times: ['08:00'], hint: 'Zu einer Mahlzeit mit Fett' },
  { name: 'Omega-3', dose: '1 g', times: ['13:00'], hint: 'Zum Essen' },
  { name: 'Magnesium', dose: '300 mg', times: ['21:00'], hint: 'Gern abends' },
  { name: 'Whey', dose: '30 g', times: ['18:00'], hint: 'Nach dem Training' },
  { name: 'Zink', dose: '10 mg', times: ['21:00'], hint: 'Nicht zusammen mit Magnesium nötig' },
  { name: 'Multivitamin', dose: '1 Tabl.', times: ['08:00'], hint: 'Zum Frühstück' },
  { name: 'Koffein', dose: '200 mg', times: ['17:00'], hint: 'Vor dem Training' },
]

export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Wochentag 0 = Mo … 6 = So eines Datums YYYY-MM-DD. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

export interface Dose {
  supplement: Supplement
  slot: string
  taken: boolean
}

/** Alle Einnahmen eines Tages, nach Uhrzeit sortiert. */
export function dosesFor(date: string, list: Supplement[], log: SupplementLog[]): Dose[] {
  const wd = weekdayOf(date)
  const taken = new Set(log.filter((l) => l.date === date).map((l) => `${l.supplement_id}|${l.slot}`))
  return list
    .filter((s) => s.days.includes(wd))
    .flatMap((s) => [...s.times].sort().map((slot) => ({ supplement: s, slot, taken: taken.has(`${s.id}|${slot}`) })))
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.supplement.position - b.supplement.position)
}

/** Kurzbeschreibung des Plans, z. B. „täglich 08:00“ oder „Mo, Mi, Fr 18:00“. */
export function planLabel(s: Pick<Supplement, 'times' | 'days'>): string {
  const days =
    s.days.length === 7
      ? 'täglich'
      : s.days.length === 5 && [0, 1, 2, 3, 4].every((d) => s.days.includes(d))
        ? 'Mo–Fr'
        : [...s.days]
            .sort()
            .map((d) => WEEKDAYS_SHORT[d])
            .join(', ')
  return `${days} ${[...s.times].sort().join(' & ')}`
}
