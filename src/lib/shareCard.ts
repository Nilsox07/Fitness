// Inhalte der Teilen-Bilder (Training): Kennzahlen, Schlagzeile, Siegel.
// Reine Logik – gezeichnet wird in shareRender.ts. Getestet in shareCard.test.ts.

export type ShareStyle = 'card' | 'story' | 'clean'

export interface ShareStat {
  value: string
  label: string
}

export interface ShareContent {
  /** z. B. „Pull“ oder „Training“ */
  title: string
  /** z. B. „Mo, 2. November“ */
  dateLabel: string
  /** kurze, freche Zeile (eine oder zwei Zeilen im Bild) */
  headline: string
  /** genau drei Kennzahlen (fehlende werden weggelassen) */
  stats: ShareStat[]
  /** große Zahl im Hintergrund der Karte */
  bigNumber: string
  /** goldenes Siegel, z. B. { value: '8', label: 'Wochen' } */
  seal: { value: string; label: string } | null
  /** Rekord-Übung (nur Anzeige) */
  record: string | null
}

export interface WorkoutShareInput {
  title: string | null
  date: Date
  volumeKg: number
  sets: number
  exercises: number
  minutes: number | null
  weekStreak: number
  record: string | null
}

/** Volumen: ab 1 t in Tonnen mit einer Nachkommastelle, sonst kg. */
export function volumeStat(kg: number): ShareStat {
  const v = Math.max(0, Math.round(kg))
  if (v >= 1000) {
    const t = Math.round(v / 100) / 10
    return { value: t.toLocaleString('de-DE', { maximumFractionDigits: 1 }), label: 'Tonnen' }
  }
  return { value: v.toLocaleString('de-DE'), label: 'kg bewegt' }
}

/** Gleiche Eingabe → gleiche Zeile (kein Flackern in der Vorschau). */
function pick<T>(list: T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return list[Math.abs(h) % list.length]
}

const HEADLINES = {
  record: ['Neuer Rekord.', 'Stärker als je zuvor.', 'Rekord geknackt.'],
  streak: ['Läuft bei dir.', 'Dranbleiben zahlt sich aus.', 'Nicht zu stoppen.'],
  big: ['Ordentlich was bewegt.', 'Heute richtig geliefert.'],
  normal: ['Erledigt.', 'Haken dran.', 'Durchgezogen.', 'Wieder einen Schritt weiter.'],
}

export function workoutHeadline(i: WorkoutShareInput): string {
  const seed = `${i.date.toDateString()}|${i.sets}|${i.title ?? ''}`
  if (i.record) return pick(HEADLINES.record, seed)
  if (i.weekStreak >= 4) return pick(HEADLINES.streak, seed)
  if (i.volumeKg >= 8000) return pick(HEADLINES.big, seed)
  return pick(HEADLINES.normal, seed)
}

export function workoutShare(i: WorkoutShareInput): ShareContent {
  const stats: ShareStat[] = [volumeStat(i.volumeKg)]
  if (i.minutes != null && i.minutes > 0 && i.minutes < 300) stats.push({ value: `${i.minutes}`, label: 'Minuten' })
  stats.push({ value: `${i.sets}`, label: i.sets === 1 ? 'Satz' : 'Sätze' })
  if (stats.length < 3) stats.push({ value: `${i.exercises}`, label: i.exercises === 1 ? 'Übung' : 'Übungen' })

  const seal =
    i.record != null
      ? { value: '★', label: 'Rekord' }
      : i.weekStreak >= 2
        ? { value: `${i.weekStreak}`, label: 'Wochen' }
        : null

  return {
    title: (i.title ?? '').trim() || 'Training',
    dateLabel: i.date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }),
    headline: workoutHeadline(i),
    stats: stats.slice(0, 3),
    bigNumber: i.weekStreak >= 2 ? `${i.weekStreak}` : stats[0].value,
    seal,
    record: i.record,
  }
}

/** Text auf höchstens zwei Zeilen umbrechen (measure = Breite in px). */
export function wrapTwoLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (measure(next) <= maxWidth || !cur) cur = next
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length <= 2) return lines
  return [lines[0], lines.slice(1).join(' ')]
}
