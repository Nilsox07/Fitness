import type { CSSProperties, ReactNode } from 'react'
import { Apple, Check, Dumbbell, Flame, Scale, Target, Trophy, Weight, Beef } from 'lucide-react'
import { cleanReviewText, type ReviewStats, type StoredReview } from '../../lib/weeklyReview'

/** Von unten einschweben, gestaffelt. */
function rise(i: number): CSSProperties {
  return { animation: 'review-rise .45s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${120 + i * 80}ms` }
}

const fmt = (n: number) => n.toLocaleString('de-DE')

type Tone = 'good' | 'ok' | 'neutral'
const TONE: Record<Tone, string> = {
  good: 'text-success',
  ok: 'text-gold',
  neutral: 'text-cocoa',
}

function Tile({ icon, label, value, sub, tone = 'neutral', style }: {
  icon: ReactNode
  label: string
  value: string
  sub?: string
  tone?: Tone
  style?: CSSProperties
}) {
  return (
    <div className="rounded-2xl bg-cream p-3" style={style}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">
        {icon}
        {label}
      </div>
      <div className={`tabular mt-1 text-2xl font-bold tracking-tight ${TONE[tone]}`}>{value}</div>
      {sub && <div className="tabular text-xs text-cocoa-light">{sub}</div>}
    </div>
  )
}

/** Kennzahlen-Kacheln (rein aus den eigenen Daten berechnet). */
function StatTiles({ s, start }: { s: ReviewStats; start: number }) {
  const tiles: ReactNode[] = []
  const goalHit = s.sessions >= s.sessionGoal
  tiles.push(
    <Tile
      key="sessions"
      icon={<Dumbbell size={12} />}
      label="Trainings"
      value={`${s.sessions}/${s.sessionGoal}`}
      sub={goalHit ? 'Ziel geschafft' : `${s.sessionGoal - s.sessions} fehlten`}
      tone={goalHit ? 'good' : 'ok'}
    />,
  )
  tiles.push(
    <Tile
      key="volume"
      icon={<Weight size={12} />}
      label="Volumen"
      value={s.volumeKg >= 10000 ? `${fmt(Math.round(s.volumeKg / 100) / 10)} t` : `${fmt(s.volumeKg)} kg`}
      sub={s.prs > 0 ? `${s.prs} ${s.prs === 1 ? 'Rekord' : 'Rekorde'} 🏆` : 'bewegt'}
      tone={s.prs > 0 ? 'good' : 'neutral'}
    />,
  )
  if (s.avgKcal != null && s.daysLogged) {
    const diff = s.kcalTarget ? s.avgKcal - s.kcalTarget : null
    tiles.push(
      <Tile
        key="kcal"
        icon={<Flame size={12} />}
        label="Ø Kalorien"
        value={fmt(s.avgKcal)}
        sub={
          diff == null
            ? `${s.daysLogged} Tage erfasst`
            : `${diff > 0 ? '+' : ''}${fmt(diff)} zum Ziel`
        }
        tone={diff == null ? 'neutral' : Math.abs(diff) <= 150 ? 'good' : 'ok'}
      />,
    )
  }
  if (s.avgProtein != null && s.daysLogged) {
    const ok = s.proteinTarget ? s.avgProtein >= s.proteinTarget * 0.9 : false
    tiles.push(
      <Tile
        key="protein"
        icon={<Beef size={12} />}
        label="Ø Eiweiß"
        value={`${fmt(s.avgProtein)} g`}
        sub={s.proteinTarget ? `Ziel ${fmt(s.proteinTarget)} g` : undefined}
        tone={s.proteinTarget ? (ok ? 'good' : 'ok') : 'neutral'}
      />,
    )
  }
  if (s.weightDelta != null) {
    tiles.push(
      <Tile
        key="weight"
        icon={<Scale size={12} />}
        label="Gewicht"
        value={`${s.weightDelta > 0 ? '+' : ''}${s.weightDelta.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`}
        sub="in der Woche"
      />,
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t, i) => (
        <div key={i} style={rise(start + i * 0.5)} className={tiles.length % 2 === 1 && i === tiles.length - 1 ? 'col-span-2' : ''}>
          {t}
        </div>
      ))}
    </div>
  )
}

function TextCard({ icon, title, text, style }: { icon: ReactNode; title: string; text: string; style?: CSSProperties }) {
  return (
    <section className="rounded-2xl bg-cream p-4" style={style}>
      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-cocoa">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/10 text-brand">{icon}</span>
        {title}
      </h3>
      <p className="text-[15px] leading-relaxed text-cocoa">{text}</p>
    </section>
  )
}

/** Wochenfazit im App-Stil: Überschrift, Kennzahlen, Abschnitte, Erfolge und Fokus. */
export function WeeklyReviewView({ review }: { review: StoredReview }) {
  const d = review.data
  const s = review.stats

  // Altes Format: nur Fließtext → bereinigt in Absätzen zeigen.
  if (!d) {
    const paragraphs = cleanReviewText(review.text)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
    return (
      <div className="space-y-3">
        {s && <StatTiles s={s} start={0} />}
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="whitespace-pre-wrap rounded-2xl bg-cream p-4 text-[15px] leading-relaxed text-cocoa"
            style={rise(i + 2)}
          >
            {p}
          </p>
        ))}
      </div>
    )
  }

  let i = 0
  return (
    <div className="space-y-4">
      <div className="text-center" style={rise(i++)}>
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-cocoa">{d.headline}</h2>
        {d.summary && <p className="mx-auto mt-1.5 max-w-xs text-[15px] leading-relaxed text-cocoa-light">{d.summary}</p>}
      </div>

      {s && <StatTiles s={s} start={i++} />}

      {d.training && <TextCard icon={<Dumbbell size={15} />} title="Training" text={d.training} style={rise(i++ + 2)} />}
      {d.nutrition && <TextCard icon={<Apple size={15} />} title="Ernährung" text={d.nutrition} style={rise(i++ + 2)} />}

      {d.wins.length > 0 && (
        <section className="rounded-2xl bg-success/10 p-4" style={rise(i++ + 2)}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-success">
            <Trophy size={15} /> Das lief gut
          </h3>
          <ul className="space-y-1.5">
            {d.wins.map((w) => (
              <li key={w} className="flex items-start gap-2 text-sm text-cocoa">
                <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-success" />
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.focus.length > 0 && (
        <section className="rounded-2xl bg-brand/10 p-4" style={rise(i++ + 2)}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-brand">
            <Target size={15} /> Fokus nächste Woche
          </h3>
          <ol className="space-y-2">
            {d.focus.map((f, n) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-cocoa">
                <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-on-brand">
                  {n + 1}
                </span>
                {f}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
