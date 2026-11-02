import { Link } from 'react-router-dom'
import { ChevronRight, Flag } from 'lucide-react'
import { useGoalPath } from '../../hooks/useGoalPath'
import { signedKg, weeksLabel } from '../../lib/goalPath'
import { InfoTip } from '../ui/InfoTip'
import { IconBox } from '../health/ui'

const kg = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`

/** Zielgewicht mit ungefährem Weg: Rest, Spanne in Wochen, Wochenziel und Fortschrittsbalken. */
export function GoalPathCard() {
  const p = useGoalPath()

  if (p.status === 'no_target') {
    return (
      <Link to="/profile?s=goal" className="flex items-center gap-3 rounded-2xl bg-cream p-3.5 active:bg-sand/60">
        <IconBox>
          <Flag size={18} />
        </IconBox>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Zielgewicht festlegen</span>
          <span className="block truncate text-xs text-cocoa-light">Dann siehst du den ungefähren Weg</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
      </Link>
    )
  }

  const reached = p.status === 'reached'
  const pct = Math.round(p.progress * 100)

  return (
    <section className="card space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <InfoTip
          className="text-sm font-semibold text-cocoa-light"
          info={
            <span className="font-normal">
              Ungefährer Weg, kein Versprechen – Wochenziele zählen. Gerechnet mit deinem geglätteten Gewicht und{' '}
              {p.direction === 'up' ? '0,25–0,5 %' : '0,5–1 %'} deines Gewichts pro Woche.
            </span>
          }
        >
          Ziel {kg(p.target!)}
        </InfoTip>
        {p.status === 'path' && (
          <span className="tabular shrink-0 text-xs text-cocoa-muted">{weeksLabel(p.weeksMin, p.weeksMax)}</span>
        )}
      </div>

      {p.status === 'no_data' && <p className="text-sm text-cocoa-light">Trag dein Gewicht ein, dann geht’s los.</p>}

      {reached && <p className="text-xl font-bold tracking-tight">Ziel erreicht – jetzt halten</p>}

      {p.status === 'path' && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="tabular text-2xl font-bold tracking-tight">noch {kg(p.remaining)}</span>
          <span className="tabular text-sm text-cocoa-light">
            diese Woche: <b className="font-semibold text-cocoa">{signedKg(p.weekly)}</b>
          </span>
        </div>
      )}

      {p.start !== null && (p.total > 0 || reached) && (
        <div>
          <div
            className="h-2 overflow-hidden rounded-full bg-sand"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Weg zum Zielgewicht"
          >
            <div
              className={`h-full rounded-full ${reached ? 'bg-success' : 'bg-brand'}`}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          <div className="tabular mt-1 flex justify-between text-[11px] text-cocoa-muted">
            <span>Start {kg(p.start)}</span>
            {p.current !== null && !reached && <span>jetzt {kg(p.current)}</span>}
            <span>{kg(p.target!)}</span>
          </div>
        </div>
      )}

      {p.mismatch && (
        <Link to="/profile?s=goal" className="block text-xs font-medium text-gold">
          Passt nicht ganz zu deinem Ziel – im Profil prüfen
        </Link>
      )}
    </section>
  )
}
