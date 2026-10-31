import { useState } from 'react'
import { Check, Droplet, Lock, Trash2, Watch } from 'lucide-react'
import { ProgressHeader, SectionLabel } from '../components/progress/ProgressHeader'
import { Group, GroupRow, Hero, HeroPill } from '../components/health/ui'
import { InfoTip } from '../components/ui/InfoTip'
import { BuddyTip } from '../components/buddy/BuddyTip'
import { useCycleActions, useCycleLog, useCyclePeriods, useCycleState } from '../hooks/useCycle'
import { localDate, shiftDate } from '../lib/day'
import { daysBetween } from '../lib/schedule'
import { PHASE_INFO, PHASE_LABEL, SYMPTOMS, trainingHint } from '../lib/cycle'

const dateDe = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })

/** Zyklus: Phase & Zyklustag, Periode mit einem Tipp eintragen, Symptome, Verlauf. */
export default function Cycle() {
  const today = localDate()
  const { data: periods, isLoading } = useCyclePeriods()
  const state = useCycleState(today)
  const { start, end, remove, wipe } = useCycleActions()
  const { symptoms, set } = useCycleLog(today)
  const [date, setDate] = useState(today)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const last = periods?.[0]
  const running = !!last && !last.end_date && daysBetween(last.start_date, today) < 10
  const busy = start.isPending || end.isPending

  function toggleSymptom(s: string) {
    set.mutate(symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s])
  }

  return (
    <div className="space-y-5">
      <ProgressHeader title="Zyklus" subtitle="Nur für dich sichtbar" />
      <BuddyTip page="cycle" />

      {state ? (
        <Hero overline={PHASE_LABEL[state.phase]} value={`Tag ${state.day}`} index={1}>
          <p className="mt-1 text-sm text-bg/70 dark:text-cocoa-light">
            {state.onPeriod
              ? `Periode läuft · Ø ${state.periodLength} Tage`
              : state.daysUntilNext <= 0
                ? 'Periode wäre jetzt fällig'
                : `Nächste Periode in ${state.daysUntilNext} ${state.daysUntilNext === 1 ? 'Tag' : 'Tagen'}`}
            {state.rough && ' · grobe Schätzung'}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <HeroPill value={`${state.length} T.`} label="Ø Zyklus" />
            <HeroPill value={`${state.periodLength} T.`} label="Ø Periode" />
            <HeroPill value={dateDe(state.nextPeriod)} label="Nächste" />
          </div>
        </Hero>
      ) : (
        <Hero overline="Zyklus" index={1}>
          <p className="mt-1 text-xl font-bold">Wann hat deine letzte Periode begonnen?</p>
          <p className="mt-1 text-sm text-bg/70 dark:text-cocoa-light">
            {isLoading ? 'Lädt …' : 'Ein Eintrag reicht – danach wird es mit jedem Zyklus genauer.'}
          </p>
        </Hero>
      )}

      {/* Periode eintragen */}
      <section className="card space-y-3">
        {running && last ? (
          <button
            className="btn-primary w-full gap-2 py-3"
            disabled={busy}
            onClick={() => end.mutate({ id: last.id, date })}
          >
            <Check size={18} /> Periode beendet
          </button>
        ) : (
          <button className="btn-primary w-full gap-2 py-3" disabled={busy} onClick={() => start.mutate(date)}>
            <Droplet size={18} /> Periode hat begonnen
          </button>
        )}
        <label className="flex items-center justify-between gap-3 text-sm text-cocoa-light">
          Datum
          <input
            type="date"
            value={date}
            max={today}
            min={shiftDate(today, -120)}
            onChange={(e) => setDate(e.target.value || today)}
            className="rounded-xl bg-sand px-3 py-1.5 text-cocoa outline-none"
          />
        </label>
      </section>

      {state && (
        <section>
          <SectionLabel>Training heute</SectionLabel>
          <div className="card">
            <InfoTip className="text-[15px] font-semibold" info={PHASE_INFO[state.phase]}>
              {trainingHint(state)}
            </InfoTip>
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Wie fühlst du dich heute?</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleSymptom(s)}
                aria-pressed={on}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 ${
                  on ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light'
                }`}
              >
                {s}
              </button>
            )
          })}
        </div>
      </section>

      {!!periods?.length && (
        <section>
          <SectionLabel>Letzte Perioden</SectionLabel>
          <Group>
            {periods.slice(0, 8).map((p) => (
              <GroupRow
                key={p.id}
                title={`${dateDe(p.start_date)}${p.end_date ? ` – ${dateDe(p.end_date)}` : ''}`}
                sub={p.end_date ? `${daysBetween(p.start_date, p.end_date) + 1} Tage` : 'läuft / ohne Ende'}
                right={
                  p.source === 'health' ? (
                    <Watch size={16} className="text-cocoa-muted" aria-label="Aus Health Connect" />
                  ) : (
                    <button
                      aria-label="Eintrag löschen"
                      className="grid h-8 w-8 place-items-center rounded-full text-cocoa-muted active:bg-sand"
                      onClick={() => remove.mutate(p.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )
                }
              />
            ))}
          </Group>
        </section>
      )}

      <section className="space-y-2 px-1">
        <InfoTip
          className="text-xs text-cocoa-muted"
          info="Zyklusdaten sind Gesundheitsdaten: Nur du kannst sie sehen, sie erscheinen nie in der Community. Die Schätzung ist ein Richtwert und nicht zur Verhütung oder Familienplanung geeignet."
        >
          <span className="flex items-center gap-1.5">
            <Lock size={13} /> Privat · nicht zur Verhütung
          </span>
        </InfoTip>
        {confirmWipe ? (
          <div className="flex items-center gap-2">
            <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setConfirmWipe(false)}>
              Abbrechen
            </button>
            <button
              className="flex-1 rounded-xl bg-red-500/10 py-2 text-sm font-semibold text-red-500"
              onClick={() => {
                wipe.mutate()
                setConfirmWipe(false)
              }}
            >
              Wirklich alles löschen
            </button>
          </div>
        ) : (
          <button className="text-xs font-semibold text-cocoa-muted underline" onClick={() => setConfirmWipe(true)}>
            Alle Zyklusdaten löschen
          </button>
        )}
      </section>
    </div>
  )
}
