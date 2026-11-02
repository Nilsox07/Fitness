import { useState } from 'react'
import { Plus, Ruler } from 'lucide-react'
import { isMissingMeasurementsTable, useMeasurements, useSaveMeasurements } from '../../hooks/useMeasurements'
import {
  MEASURES,
  cm,
  parseMeasureInput,
  signedCm,
  summarizeMeasurements,
  type MeasureKey,
  type MeasurementRow,
} from '../../lib/measurements'
import { localDate } from '../../lib/day'
import { SectionTitle } from '../food-progress/ui'
import { Sparkline } from '../exercises/MuscleBits'
import { InfoTip } from '../ui/InfoTip'
import { PremiumSheet } from '../ui/PremiumSheet'
import { ErrorNote } from '../ui/GroupList'
import { IconBox } from '../health/ui'

const HOW_TO =
  'Morgens vor dem Frühstück, entspannt stehen, Maßband waagerecht und anliegend – nicht einschnüren. ' +
  'Taille: auf Höhe des Bauchnabels. Brust: über die Brustwarzen. Oberarm: dickste Stelle, Arm locker hängend. ' +
  'Hüfte: breiteste Stelle am Po. Oberschenkel: dickste Stelle, immer dieselbe Seite. Alle 2–4 Wochen reicht.'

/** Körpermaße: letzte Werte mit Veränderung seit Start, Mini-Verlauf und Eintragen-Sheet. */
export function MeasurementsSection() {
  const { data: rows = [], isLoading } = useMeasurements()
  const [open, setOpen] = useState(false)
  const summary = summarizeMeasurements(rows)

  if (isLoading) return null

  return (
    <section>
      <SectionTitle
        right={
          <button
            className="flex items-center gap-1 font-semibold text-brand"
            aria-label="Körpermaße eintragen"
            onClick={() => setOpen(true)}
          >
            <Plus size={14} /> Eintragen
          </button>
        }
      >
        Körpermaße
      </SectionTitle>

      {summary.length === 0 ? (
        <button
          className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3.5 text-left active:bg-sand/60"
          onClick={() => setOpen(true)}
        >
          <IconBox>
            <Ruler size={18} />
          </IconBox>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Taille & Co. eintragen</span>
            <span className="block text-xs text-cocoa-light">Zeigt Fortschritt, auch wenn die Waage steht</span>
          </span>
        </button>
      ) : (
        <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
          {summary.map((s) => (
            <div key={s.key} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.label}</span>
                {s.series.length > 1 && (
                  <span className="tabular block text-xs text-cocoa-light">{signedCm(s.change)} seit Start</span>
                )}
              </span>
              <Sparkline values={s.series} />
              <span className="tabular w-[4.5rem] shrink-0 text-right font-semibold">{cm(s.latest)}</span>
            </div>
          ))}
        </div>
      )}

      <InfoTip className="mt-1.5 px-1 text-xs text-cocoa-muted" info={HOW_TO}>
        So misst du richtig
      </InfoTip>

      {open && <MeasureSheet rows={rows} onClose={() => setOpen(false)} />}
    </section>
  )
}

function MeasureSheet({ rows, onClose }: { rows: MeasurementRow[]; onClose: () => void }) {
  const today = localDate()
  const save = useSaveMeasurements()
  const summary = summarizeMeasurements(rows)
  const last = Object.fromEntries(summary.map((s) => [s.key, s.latest])) as Partial<Record<MeasureKey, number>>
  const todays = rows.find((r) => r.date === today)
  const [form, setForm] = useState<Partial<Record<MeasureKey, string>>>(() =>
    Object.fromEntries(
      MEASURES.map(({ key }) => {
        const v = todays?.[key]
        return [key, typeof v === 'number' ? String(v).replace('.', ',') : '']
      }),
    ),
  )
  const [error, setError] = useState<string | null>(null)
  const parsed = parseMeasureInput(form)
  const empty = Object.keys(parsed.values).length === 0

  async function submit() {
    if (parsed.errors.length) {
      setError('Bitte Werte zwischen 10 und 250 cm eintragen.')
      return
    }
    if (empty) return
    setError(null)
    try {
      await save.mutateAsync({ date: today, values: parsed.values })
      onClose()
    } catch (e) {
      setError(
        isMissingMeasurementsTable(e)
          ? 'Körpermaße gehen hier noch nicht – das Update kommt gleich.'
          : 'Speichern hat nicht geklappt. Versuch’s nochmal.',
      )
    }
  }

  return (
    <PremiumSheet
      title="Körpermaße"
      subtitle="Nur ausfüllen, was du messen willst"
      onClose={onClose}
      busy={save.isPending}
      footer={
        <button className="btn-primary w-full rounded-2xl py-3" onClick={submit} disabled={empty || save.isPending}>
          {save.isPending ? 'Speichert…' : 'Speichern'}
        </button>
      }
    >
      <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
        {MEASURES.map(({ key, label }) => (
          <label key={key} className="flex min-h-[3.25rem] items-center gap-3 px-4 py-2" htmlFor={`measure-${key}`}>
            <span className="flex-1 text-[15px] font-semibold">{label}</span>
            <input
              id={`measure-${key}`}
              type="text"
              inputMode="decimal"
              placeholder={last[key] !== undefined ? String(last[key]).replace('.', ',') : '–'}
              aria-invalid={parsed.errors.includes(key)}
              className={`tabular w-20 rounded-xl bg-sand px-2.5 py-1.5 text-right text-base font-semibold outline-none focus:ring-2 focus:ring-ruby ${
                parsed.errors.includes(key) ? 'ring-2 ring-red-400' : ''
              }`}
              value={form[key] ?? ''}
              onChange={(e) => setForm({ ...form, [key]: e.target.value.replace(/[^\d,.]/g, '') })}
            />
            <span className="w-8 text-sm text-cocoa-light">cm</span>
          </label>
        ))}
      </div>
      <ErrorNote error={error} />
    </PremiumSheet>
  )
}
