import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Check, ChevronRight, Search, Sparkles, Wand2, X } from 'lucide-react'
import { matchExercisesToLibrary } from '../../lib/ai'
import { setLinks, suggestLinks, type LibraryExercise } from '../../lib/exerciseLibrary'
import type { Exercise } from '../../types'
import { Sheet } from '../workout/Sheet'
import { ExerciseAnimation } from '../library/ExerciseAnimation'
import { LibrarySheet } from '../library/LibrarySheet'

const DISMISS_KEY = 'exercise_autolink_dismissed'

function readDismissed(): number {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

/**
 * Hinweis-Karte „N Übungen ohne Animation — jetzt zuordnen". Ausblenden merkt
 * sich die Anzahl; kommen neue unverknüpfte Übungen dazu, erscheint sie wieder.
 */
export function UnlinkedCard({ count, onOpen, style }: { count: number; onOpen: () => void; style?: CSSProperties }) {
  const [dismissed, setDismissed] = useState(readDismissed)
  if (count === 0 || count <= dismissed) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(count))
    } catch {
      /* ignore */
    }
    setDismissed(count)
  }

  return (
    <section className="flex items-center gap-1 rounded-2xl bg-brand/10 pr-1.5 ring-1 ring-brand/20" style={style}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left" onClick={onOpen}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
          <Wand2 size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-cocoa">
            {count} {count === 1 ? 'Übung' : 'Übungen'} ohne Animation
          </span>
          <span className="block truncate text-xs text-cocoa-light">Jetzt mit der Bibliothek zuordnen</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
      </button>
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-muted active:bg-sand"
        onClick={dismiss}
        aria-label="Hinweis ausblenden"
      >
        <X size={16} />
      </button>
    </section>
  )
}

type AiState = 'off' | 'busy' | 'done' | 'error'

/**
 * Prüf-Sheet: je unverknüpfter Übung der beste Bibliotheks-Treffer (unscharfer
 * Abgleich, optional per KI verfeinert) — übernehmen, ändern oder überspringen.
 */
export function AutoLinkSheet({
  exercises,
  list,
  aiOn,
  onClose,
}: {
  exercises: Exercise[]
  list: LibraryExercise[]
  aiOn: boolean
  onClose: () => void
}) {
  const byId = useMemo(() => new Map(list.map((e) => [e.id, e])), [list])
  // Feste Auswahl beim Öffnen (die Liste schrumpft sonst beim Speichern)
  const [items] = useState(exercises)
  const suggestions = useMemo(() => {
    const m = new Map<string, LibraryExercise[]>()
    for (const ex of items) m.set(ex.id, suggestLinks(ex.name, ex.muscle_group, list, 3))
    return m
  }, [items, list])

  const [choice, setChoice] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(items.map((ex) => [ex.id, suggestions.get(ex.id)?.[0]?.id ?? null])),
  )
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [picking, setPicking] = useState<Exercise | null>(null)
  const [ai, setAi] = useState<AiState>(aiOn ? 'busy' : 'off')

  // KI-Verfeinerung: ein Aufruf für alle Übungen, Kandidaten aus dem unscharfen Abgleich.
  useEffect(() => {
    if (!aiOn) return
    let alive = true
    const candidates: Record<string, { id: string; name: string; name_en: string; muscle: string }[]> = {}
    for (const ex of items) {
      candidates[ex.id] = suggestLinks(ex.name, ex.muscle_group, list, 8).map((c) => ({
        id: c.id,
        name: c.name_de,
        name_en: c.name_en,
        muscle: c.muscle,
      }))
    }
    matchExercisesToLibrary(
      items.map((ex) => ({ id: ex.id, name: ex.name, muscle: ex.muscle_group })),
      candidates,
    )
      .then((res) => {
        if (!alive) return
        setChoice((prev) => {
          const next = { ...prev }
          for (const ex of items) if (res[ex.id]) next[ex.id] = res[ex.id]
          return next
        })
        // KI findet keinen passenden Kandidaten → standardmäßig überspringen
        setSkipped((prev) => {
          const next = new Set(prev)
          for (const ex of items) if (!res[ex.id] && (candidates[ex.id] ?? []).length > 0) next.add(ex.id)
          return next
        })
        setAi('done')
      })
      .catch(() => alive && setAi('error'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const accepted = items.filter((ex) => choice[ex.id] && !skipped.has(ex.id))

  function choose(exId: string, libId: string) {
    setChoice((c) => ({ ...c, [exId]: libId }))
    setSkipped((s) => {
      const n = new Set(s)
      n.delete(exId)
      return n
    })
  }

  function toggleSkip(exId: string) {
    setSkipped((s) => {
      const n = new Set(s)
      if (n.has(exId)) n.delete(exId)
      else n.add(exId)
      return n
    })
  }

  function saveAll() {
    const patch: Record<string, string> = {}
    for (const ex of accepted) patch[ex.id] = choice[ex.id]!
    if (Object.keys(patch).length) setLinks(patch)
    onClose()
  }

  if (picking) {
    return (
      <LibrarySheet
        title={`Für „${picking.name}"`}
        mode="pick"
        suggestions={suggestLinks(picking.name, picking.muscle_group, list, 5)}
        currentId={choice[picking.id] ?? null}
        onPick={(item) => {
          choose(picking.id, item.id)
          setPicking(null)
        }}
        onClose={() => setPicking(null)}
      />
    )
  }

  return (
    <Sheet title="Animationen zuordnen" onClose={onClose}>
      <p className="text-xs text-cocoa-light">
        Wir haben passende Übungen aus der Bibliothek gesucht. Prüfe die Vorschläge — danach siehst du
        Animation &amp; Ausführung bei deinen Übungen.
      </p>
      {ai === 'busy' && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
          <Sparkles size={14} className="animate-pulse" /> KI prüft die Vorschläge …
        </p>
      )}
      {ai === 'done' && (
        <p className="flex items-center gap-1.5 text-xs text-cocoa-light">
          <Sparkles size={14} className="text-brand" /> Von der KI geprüft
        </p>
      )}
      {ai === 'error' && (
        <p className="text-xs text-cocoa-muted">KI nicht erreichbar — Vorschläge per Namensabgleich.</p>
      )}

      <ul className="space-y-2">
        {items.map((ex) => {
          const sel = choice[ex.id] ? byId.get(choice[ex.id]!) ?? null : null
          const on = !!sel && !skipped.has(ex.id)
          const alts = (suggestions.get(ex.id) ?? []).filter((a) => a.id !== sel?.id)
          return (
            <li key={ex.id} className={`rounded-2xl bg-sand-light p-2.5 transition-opacity ${on ? '' : 'opacity-70'}`}>
              <div className="flex items-center gap-3">
                {sel ? (
                  <ExerciseAnimation images={sel.images} alt="" still className="h-14 w-14 shrink-0 rounded-xl" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-muted">
                    <Search size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-cocoa">{ex.name}</div>
                  <div className="truncate text-xs text-cocoa-light">
                    {sel ? <>→ {sel.name_de}</> : 'Kein Vorschlag gefunden'}
                  </div>
                  {sel && (
                    <div className="truncate text-[11px] text-cocoa-muted">
                      {sel.muscle} · {sel.equipment}
                    </div>
                  )}
                </div>
                {sel && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={on ? 'Überspringen' : 'Übernehmen'}
                    onClick={() => toggleSkip(ex.id)}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
                      on ? 'bg-success text-white' : 'bg-cream text-cocoa-muted ring-1 ring-sand-dark'
                    }`}
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                )}
              </div>
              <div className="-mx-2.5 mt-2 flex gap-1.5 overflow-x-auto px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {alts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => choose(ex.id, a.id)}
                    className="max-w-[60%] shrink-0 truncate rounded-full bg-cream px-2.5 py-1 text-[11px] font-medium text-cocoa-light ring-1 ring-sand-dark/60"
                  >
                    {a.name_de}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPicking(ex)}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-cocoa px-2.5 py-1 text-[11px] font-semibold text-cream"
                >
                  <Search size={11} /> {sel ? 'Ändern' : 'Suchen'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex gap-2 pt-1">
        <button className="btn-ghost flex-1" onClick={onClose}>
          Später
        </button>
        <button className="btn-primary flex-[2]" onClick={saveAll} disabled={accepted.length === 0}>
          {accepted.length === items.length ? 'Alle übernehmen' : `${accepted.length} übernehmen`}
        </button>
      </div>
    </Sheet>
  )
}
