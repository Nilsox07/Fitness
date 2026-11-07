import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { InfoTip } from '../ui/InfoTip'
import type { FoodEntry, Sex } from '../../types'
import { MICRO_INFO, fmtMicro, lowest, microDay, type Micros } from '../../lib/micros'

/**
 * Vitamine & Mineralstoffe des Tages (geschätzt): eine Zeile mit dem Knappsten,
 * aufgeklappt alle Werte mit Balken gegen die DGE-Referenz.
 */
export function MicroCard({ entries, sex, style }: { entries: FoodEntry[]; sex: Sex | null; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const day = useMemo(() => microDay(entries, sex), [entries, sex])
  if (!day) {
    if (!entries.length) return null
    // Einträge da, aber ohne Vitamin-Daten (z. B. manuell oder ältere Einträge) – kurz erklären statt verstecken
    return (
      <section className="card px-4 py-3" style={style}>
        <InfoTip
          className="text-sm"
          info="Vitamine und Mineralstoffe schätzt Buddy, wenn du per Foto oder „Beschreiben“ einträgst. Bei Barcode-Produkten zählen die Angaben der Packung, falls vorhanden. Manuelle und ältere Einträge haben keine Vitamin-Daten."
        >
          <span className="font-semibold">Vitamine & Mineralstoffe</span>
          <span className="block text-xs text-cocoa-muted">Kommen mit Foto, Beschreiben oder Barcode</span>
        </InfoTip>
      </section>
    )
  }
  const low = lowest(day)
  const partial = day.coverage < 0.6

  return (
    <section className="card overflow-hidden p-0" style={style}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-sand-light"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight">Vitamine & Mineralstoffe</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-cocoa-light">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${low.length ? 'bg-gold' : 'bg-good'}`} />
            {low.length ? `Noch wenig: ${low.map((r) => r.label).join(', ')}` : 'Gut dabei'}
            {partial && <span className="text-cocoa-muted"> · teilweise erfasst</span>}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-cocoa-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="anim-fade space-y-2.5 border-t border-sand-dark/30 px-4 pb-4 pt-3">
          {day.rows.map((r) => {
            const pct = Math.min(1, r.share)
            return (
              <div key={r.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <InfoTip
                    className="min-w-0"
                    info={`${MICRO_INFO[r.key].why}. Gute Quellen: ${MICRO_INFO[r.key].sources}. Richtwert ${fmtMicro(r.target, r.unit)} pro Tag (DGE).`}
                  >
                    <span className="font-medium text-cocoa">{r.label}</span>
                  </InfoTip>
                  <span className="tabular shrink-0 text-xs text-cocoa-muted">
                    <span className="font-semibold text-cocoa">{fmtMicro(r.amount, r.unit)}</span> /{' '}
                    {fmtMicro(r.target, r.unit)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${r.share >= 1 ? 'bg-success' : 'bg-brand'}`}
                    style={{ width: `${Math.max(2, pct * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
          <InfoTip
            className="pt-1 text-xs text-cocoa-muted"
            info={`Buddy schätzt die Werte je Lebensmittel aus Nährwerttabellen; bei Barcode-Produkten zählen die Angaben der Packung (falls vorhanden). Das ist eine Orientierung, kein Laborwert.${
              partial
                ? ` Heute haben nur ${Math.round(day.coverage * 100)} % deiner Kalorien Vitamin-Daten – manuelle und ältere Einträge zählen nicht mit.`
                : ''
            } Vitamin D kommt vor allem über Sonne.`}
          >
            Geschätzt · Richtwerte der DGE
          </InfoTip>
        </div>
      )}
    </section>
  )
}

/** Vitamine einer Mahlzeit (Analyse): die vier stärksten als kleine Balken, Anteil am Tagesbedarf. */
export function MealMicros({
  items,
  sex = null,
}: {
  items: { kcal: number; micros?: Micros | null }[]
  sex?: Sex | null
}) {
  const day = microDay(items, sex)
  if (!day) return null
  const top = [...day.rows]
    .filter((r) => r.share >= 0.08)
    .sort((a, b) => b.share - a.share)
    .slice(0, 4)
  if (!top.length) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
        Vitamine & Mineralstoffe · vom Tagesbedarf
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {top.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-cocoa">{r.label}</span>
              <span className="tabular text-cocoa-muted">{Math.round(r.share * 100)} %</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
              <div
                className={`h-full rounded-full ${r.share >= 1 ? 'bg-success' : 'bg-brand'}`}
                style={{ width: `${Math.max(4, Math.min(1, r.share) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
