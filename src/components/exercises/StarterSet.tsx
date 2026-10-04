import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, ClipboardList, Rocket, TriangleAlert } from 'lucide-react'
import { useCreateExercise, useExercises } from '../../hooks/useExercises'
import { nextPlanPosition, useAddPlanExercise, useCreatePlan, usePlans } from '../../hooks/usePlans'
import { getLinks, setLinks } from '../../lib/exerciseLibrary'
import { STARTER_TEMPLATES, planStarter, type StarterId } from '../../lib/starterSets'
import { Sheet } from '../workout/Sheet'
import { useLibrary } from '../library/useLibrary'
import { Toggle } from '../profile/ui'

/** Karte „Mit Standard-Übungen starten" (für Nutzer mit wenigen Übungen). */
export function StarterSetCard({ style, tone = 'cream' }: { style?: CSSProperties; tone?: 'cream' | 'brand' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={style}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.99] ${
          tone === 'brand' ? 'bg-brand/10 ring-1 ring-brand/20' : 'bg-cream'
        }`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
          <Rocket size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-cocoa">Mit Standard-Übungen starten</span>
          <span className="block truncate text-xs text-cocoa-light">
            Ganzkörper, Push-Pull-Beine oder Ober-/Unterkörper — mit Animationen
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
      </button>
      {open && <StarterSheet onClose={() => setOpen(false)} />}
    </>
  )
}

type Phase = { kind: 'pick' } | { kind: 'busy'; step: string } | { kind: 'done'; exercises: number; plans: number }

export function StarterSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { list, error: libError, loading, retry } = useLibrary()
  const { data: mine } = useExercises()
  const { data: plans } = usePlans()
  const createEx = useCreateExercise()
  const createPlan = useCreatePlan()
  const addPlanEx = useAddPlanExercise()

  const [templateId, setTemplateId] = useState<StarterId>('fullbody')
  const [withPlans, setWithPlans] = useState(true)
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' })
  const [err, setErr] = useState<string | null>(null)

  const template = STARTER_TEMPLATES.find((t) => t.id === templateId)!
  const preview = useMemo(
    () =>
      list && mine && plans
        ? planStarter(template, mine, plans.map((p) => p.name), list, getLinks())
        : null,
    [template, list, mine, plans],
  )

  async function run() {
    if (!preview || phase.kind === 'busy') return
    setErr(null)
    let madeEx = 0
    let madePlans = 0
    try {
      const idByLib = new Map(preview.existing)
      const links: Record<string, string> = {}
      for (const [i, c] of preview.create.entries()) {
        setPhase({ kind: 'busy', step: `Übung ${i + 1} von ${preview.create.length}: ${c.input.name}` })
        const created = await createEx.mutateAsync(c.input)
        idByLib.set(c.lib, created.id)
        links[created.id] = c.lib
        madeEx++
      }
      if (Object.keys(links).length) setLinks(links)

      if (withPlans) {
        let pos = nextPlanPosition(plans)
        for (const p of preview.plans) {
          if (p.exists) continue
          setPhase({ kind: 'busy', step: `Plan „${p.name}"` })
          const plan = await createPlan.mutateAsync({ name: p.name, position: pos++ })
          const ids = p.libs.map((l) => idByLib.get(l)).filter((x): x is string => !!x)
          for (const [position, exercise_id] of ids.entries()) {
            await addPlanEx.mutateAsync({ plan_id: plan.id, exercise_id, position })
          }
          madePlans++
        }
      }
      setPhase({ kind: 'done', exercises: madeEx, plans: madePlans })
    } catch (e) {
      setErr(`Konnte nicht alles anlegen: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}. Erneut versuchen legt nur Fehlendes an.`)
      setPhase({ kind: 'pick' })
    }
  }

  if (phase.kind === 'done') {
    return (
      <Sheet title="Fertig!" onClose={onClose}>
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
            <Check size={28} strokeWidth={3} />
          </span>
          <p className="text-sm text-cocoa">
            {phase.exercises} {phase.exercises === 1 ? 'Übung' : 'Übungen'} angelegt
            {phase.plans > 0 && ` · ${phase.plans} ${phase.plans === 1 ? 'Plan' : 'Pläne'}`}
          </p>
          <p className="text-xs text-cocoa-light">Alle mit Animation &amp; Ausführung aus der Bibliothek.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Schließen
          </button>
          {phase.plans > 0 && (
            <button
              className="btn-primary flex-1"
              onClick={() => {
                onClose()
                navigate('/plans')
              }}
            >
              Zu den Plänen
            </button>
          )}
        </div>
      </Sheet>
    )
  }

  const busy = phase.kind === 'busy'
  const newPlans = preview?.plans.filter((p) => !p.exists) ?? []

  return (
    <Sheet title="Standard-Übungen" onClose={busy ? () => {} : onClose}>
      <p className="text-xs text-cocoa-light">
        Wähle dein Ziel — wir legen bewährte Übungen mit Animation, Ausführung und passenden
        Wiederholungsbereichen an. Vorhandene Übungen werden nicht doppelt angelegt.
      </p>

      <div className="space-y-2" role="radiogroup" aria-label="Vorlage">
        {STARTER_TEMPLATES.map((t) => {
          const on = t.id === templateId
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy}
              onClick={() => setTemplateId(t.id)}
              className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                on ? 'bg-brand/10 ring-2 ring-brand' : 'bg-sand-light ring-1 ring-sand-dark/40'
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  on ? 'border-brand bg-brand text-on-brand' : 'border-sand-dark'
                }`}
              >
                {on && <Check size={12} strokeWidth={3.5} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-cocoa">{t.title}</span>
                  <span className="shrink-0 text-[11px] text-cocoa-muted">{t.days}</span>
                </span>
                <span className="block text-xs text-cocoa-light">{t.desc}</span>
                <span className="mt-1 block text-[11px] text-cocoa-muted">
                  Pläne: {t.plans.map((p) => p.name).join(' · ')}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {loading && <div className="h-20 animate-pulse rounded-2xl bg-sand" aria-hidden />}
      {libError && (
        <div className="space-y-2 rounded-2xl bg-sand-light p-3 text-sm">
          <p className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
            <TriangleAlert size={16} className="shrink-0" /> {libError}
          </p>
          <button className="btn-ghost w-full" onClick={retry}>
            Erneut versuchen
          </button>
        </div>
      )}

      {preview && (
        <div className="space-y-2 rounded-2xl bg-sand-light p-3">
          <p className="text-sm font-semibold text-cocoa">
            {preview.create.length} neue {preview.create.length === 1 ? 'Übung' : 'Übungen'}
            {preview.existing.size > 0 && (
              <span className="font-normal text-cocoa-light"> · {preview.existing.size} schon vorhanden</span>
            )}
          </p>
          <p className="text-xs leading-relaxed text-cocoa-light">
            {preview.create.map((c) => c.input.name).join(', ') || 'Alle Übungen dieser Vorlage hast du schon.'}
          </p>
          <div className="flex items-center gap-3 border-t border-sand-dark/40 pt-2">
            <ClipboardList size={16} className="shrink-0 text-cocoa-light" />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block font-medium text-cocoa">Passende Pläne anlegen</span>
              <span className="block truncate text-xs text-cocoa-light">
                {newPlans.length > 0
                  ? newPlans.map((p) => p.name).join(' · ')
                  : 'Pläne mit diesen Namen gibt es schon'}
              </span>
            </span>
            <Toggle checked={withPlans && newPlans.length > 0} onChange={setWithPlans} label="Pläne anlegen" />
          </div>
        </div>
      )}

      {err && (
        <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
          <TriangleAlert size={16} className="shrink-0" /> {err}
        </p>
      )}
      {busy && <p className="truncate text-center text-xs text-cocoa-light">{phase.step} …</p>}

      <button
        className="btn-primary w-full"
        onClick={run}
        disabled={!preview || busy || (preview.create.length === 0 && (!withPlans || newPlans.length === 0))}
      >
        {busy ? 'Lege an…' : 'Übernehmen'}
      </button>
    </Sheet>
  )
}
