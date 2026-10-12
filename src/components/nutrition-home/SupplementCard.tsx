import { useState, type CSSProperties } from 'react'
import { Bell, BellOff, Check, ChevronRight, Pill, Plus, Trash2, X } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import {
  useDeleteSupplement,
  useSaveSupplement,
  useSupplementLog,
  useSupplements,
  useToggleDose,
} from '../../hooks/useSupplements'
import { SUPPLEMENT_PRESETS, WEEKDAYS_SHORT, dosesFor, planLabel, type Supplement } from '../../lib/supplements'

/** Supplemente von heute zum Abhaken; „Verwalten“ öffnet Plan & Erinnerungen. */
export function SupplementCard({ date, style }: { date: string; style?: CSSProperties }) {
  const { data: list = [] } = useSupplements()
  const { data: log = [] } = useSupplementLog(date)
  const toggle = useToggleDose()
  const [manage, setManage] = useState(false)
  const doses = dosesFor(date, list, log)
  const done = doses.filter((d) => d.taken).length

  return (
    <section className="card space-y-3" style={style}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <Pill size={16} />
          </span>
          <h2 className="font-semibold">Supplemente</h2>
          {doses.length > 0 && (
            <span className="tabular text-sm text-cocoa-light">
              {done}/{doses.length}
            </span>
          )}
        </div>
        <button className="text-sm font-semibold text-brand" onClick={() => setManage(true)}>
          {list.length ? 'Verwalten' : 'Hinzufügen'}
        </button>
      </div>

      {list.length === 0 ? (
        <button
          className="flex w-full items-center gap-3 rounded-2xl bg-sand/60 p-3 text-left"
          onClick={() => setManage(true)}
        >
          <Plus size={18} className="text-brand" />
          <span className="text-sm text-cocoa-light">Kreatin, Vitamin D & Co. eintragen – mit Erinnerung</span>
        </button>
      ) : doses.length === 0 ? (
        <p className="text-sm text-cocoa-light">Heute steht nichts an.</p>
      ) : (
        <div className="space-y-1.5">
          {doses.map((d) => (
            <button
              key={d.supplement.id + d.slot}
              onClick={() => toggle.mutate({ supplementId: d.supplement.id, date, slot: d.slot, taken: !d.taken })}
              aria-pressed={d.taken}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99] ${
                d.taken ? 'bg-success/10' : 'bg-sand/60'
              }`}
            >
              <span className="tabular w-11 shrink-0 text-xs font-semibold text-cocoa-light">{d.slot}</span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm font-semibold ${d.taken ? 'text-cocoa-light line-through' : ''}`}
                >
                  {d.supplement.name}
                </span>
                {d.supplement.dose && <span className="block text-xs text-cocoa-muted">{d.supplement.dose}</span>}
              </span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  d.taken ? 'bg-success text-white' : 'ring-2 ring-inset ring-sand-dark'
                }`}
              >
                {d.taken && <Check size={15} strokeWidth={3} className="anim-check" />}
              </span>
            </button>
          ))}
        </div>
      )}

      {manage && <ManageSheet list={list} onClose={() => setManage(false)} />}
    </section>
  )
}

type Draft = Pick<Supplement, 'name' | 'dose' | 'times' | 'days' | 'remind'> & { id?: string }

const EMPTY: Draft = { name: '', dose: '', times: ['08:00'], days: [0, 1, 2, 3, 4, 5, 6], remind: true }

function ManageSheet({ list, onClose }: { list: Supplement[]; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(list.length ? null : { ...EMPTY })
  const save = useSaveSupplement()
  const del = useDeleteSupplement()

  async function submit() {
    if (!draft || !draft.name.trim() || draft.times.length === 0 || draft.days.length === 0) return
    await save.mutateAsync({
      ...draft,
      name: draft.name.trim(),
      dose: draft.dose.trim(),
      times: [...new Set(draft.times)].sort(),
      days: [...draft.days].sort(),
      ...(draft.id ? {} : { position: list.length }),
    })
    setDraft(null)
  }

  return (
    <PremiumSheet
      title={draft ? (draft.id ? 'Supplement bearbeiten' : 'Neues Supplement') : 'Supplemente'}
      subtitle={draft ? undefined : 'Was, wie viel und wann'}
      leading={
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
          <Pill size={18} />
        </span>
      }
      onBack={draft && list.length ? () => setDraft(null) : undefined}
      onClose={onClose}
      busy={save.isPending}
      footer={
        draft ? (
          <button
            className="btn-primary w-full rounded-2xl py-3"
            onClick={submit}
            disabled={save.isPending || !draft.name.trim() || !draft.times.length || !draft.days.length}
          >
            Speichern
          </button>
        ) : (
          <button className="btn-primary w-full gap-2 rounded-2xl py-3" onClick={() => setDraft({ ...EMPTY })}>
            <Plus size={18} /> Supplement hinzufügen
          </button>
        )
      }
    >
      {!draft && (
        <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
          {list.map((s) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2.5">
              <button
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() =>
                  setDraft({ id: s.id, name: s.name, dose: s.dose, times: s.times, days: s.days, remind: s.remind })
                }
              >
                {s.remind ? (
                  <Bell size={16} className="shrink-0 text-brand" />
                ) : (
                  <BellOff size={16} className="shrink-0 text-cocoa-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {s.name}
                    {s.dose && <span className="font-normal text-cocoa-light"> · {s.dose}</span>}
                  </span>
                  <span className="tabular block text-xs text-cocoa-light">{planLabel(s)}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
              </button>
              <button
                aria-label={`${s.name} löschen`}
                className="grid h-9 w-9 place-items-center rounded-full text-cocoa-muted"
                onClick={() => del.mutate(s.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <>
          {!draft.id && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {SUPPLEMENT_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setDraft({ ...draft, name: p.name, dose: p.dose, times: p.times })}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                    draft.name === p.name ? 'bg-cocoa text-bg' : 'bg-cream'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <label className="block">
              <span className="label">Name</span>
              <input
                className="input rounded-2xl"
                maxLength={40}
                placeholder="z. B. Kreatin"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Menge</span>
              <input
                className="input rounded-2xl"
                maxLength={30}
                placeholder="5 g"
                value={draft.dose}
                onChange={(e) => setDraft({ ...draft, dose: e.target.value })}
              />
            </label>
          </div>
          {SUPPLEMENT_PRESETS.find((p) => p.name === draft.name) && (
            <p className="-mt-2 px-1 text-xs text-cocoa-muted">
              Tipp: {SUPPLEMENT_PRESETS.find((p) => p.name === draft.name)!.hint}
            </p>
          )}

          <section className="space-y-2">
            <span className="label">Uhrzeit</span>
            <div className="flex flex-wrap items-center gap-2">
              {draft.times.map((t, i) => (
                <span key={i} className="flex items-center gap-1 rounded-xl bg-cream py-1 pl-2 pr-1">
                  <input
                    type="time"
                    step={300}
                    aria-label={`Uhrzeit ${i + 1}`}
                    className="tabular w-[4.75rem] bg-transparent text-sm font-semibold outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                    value={t}
                    onChange={(e) =>
                      e.target.value &&
                      setDraft({ ...draft, times: draft.times.map((x, j) => (j === i ? e.target.value : x)) })
                    }
                  />
                  {draft.times.length > 1 && (
                    <button
                      aria-label="Uhrzeit entfernen"
                      className="grid h-6 w-6 place-items-center rounded-full text-cocoa-muted"
                      onClick={() => setDraft({ ...draft, times: draft.times.filter((_, j) => j !== i) })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              ))}
              {draft.times.length < 4 && (
                <button
                  className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-brand"
                  onClick={() => setDraft({ ...draft, times: [...draft.times, '20:00'] })}
                >
                  <Plus size={15} /> Uhrzeit
                </button>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <span className="label">Tage</span>
            <div className="flex gap-1.5">
              {WEEKDAYS_SHORT.map((d, i) => {
                const on = draft.days.includes(i)
                return (
                  <button
                    key={d}
                    aria-pressed={on}
                    onClick={() =>
                      setDraft({ ...draft, days: on ? draft.days.filter((x) => x !== i) : [...draft.days, i] })
                    }
                    className={`h-9 flex-1 rounded-full text-xs font-semibold ${on ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa-light'}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </section>

          <button
            role="switch"
            aria-checked={draft.remind}
            onClick={() => setDraft({ ...draft, remind: !draft.remind })}
            className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3.5 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Erinnern</span>
              <span className="block text-xs text-cocoa-light">Push zur Uhrzeit, wenn noch nicht abgehakt</span>
            </span>
            <span
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${draft.remind ? 'bg-success' : 'bg-sand-dark'}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${draft.remind ? 'left-[22px]' : 'left-0.5'}`}
              />
            </span>
          </button>
          {save.error && <p className="text-sm text-red-500">{(save.error as Error).message}</p>}
        </>
      )}
    </PremiumSheet>
  )
}
