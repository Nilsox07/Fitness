import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GripVertical, LayoutGrid, MinusCircle, PlusCircle, SlidersHorizontal } from 'lucide-react'
import { TabHeader } from '../components/ui/TabHeader'
import { PremiumSheet } from '../components/ui/PremiumSheet'
import { renderWidget } from '../components/today/Widgets'
import { enter } from '../components/home/motion'
import { useToday } from '../hooks/useToday'
import type { Capabilities } from '../lib/health'
import { useUserPrefs } from '../hooks/usePrefsSync'
import { usePrefs } from '../lib/prefs'
import {
  addableWidgets,
  mergeLayout,
  moveItem,
  visibleLayout,
  widgetDef,
  type Modules,
  type WidgetId,
} from '../lib/dashboard'
import { BuddyTip } from '../components/buddy/BuddyTip'

export function useModules(): Modules {
  const { showNutrition, showSocial, hasWatch } = usePrefs()
  return { training: true, nutrition: showNutrition, social: showSocial, watch: hasWatch }
}

/** „Heute“: frei anpassbares Dashboard (Widgets hinzufügen, entfernen, verschieben). */
export default function Today() {
  const t = useToday()
  const mods = useModules()
  const { prefs } = useUserPrefs()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(() => params.has('edit'))
  // ?edit=1 (aus der Suche) nur einmal auswerten
  useEffect(() => {
    if (params.has('edit')) setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const layout = visibleLayout(prefs.dashboard, mods, t.caps)

  const dateLabel = new Date(t.day + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-4">
      <TabHeader overline={dateLabel} title="Heute" style={enter(0)} />
      <BuddyTip page="today" />
      <div className="grid grid-cols-2 gap-3">
        {layout.map((id, i) => (
          <div
            key={id}
            className={`empty:hidden ${widgetDef(id).size === 'full' ? 'col-span-2' : ''}`}
            style={enter(i + 1)}
          >
            {renderWidget(id, t)}
          </div>
        ))}
      </div>
      {layout.length === 0 && (
        <p className="card text-center text-sm text-cocoa-light">Noch keine Widgets – füge welche hinzu.</p>
      )}
      <button
        className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-cocoa-light transition active:scale-95"
        onClick={() => setEditing(true)}
      >
        <LayoutGrid size={15} />
        Heute anpassen
      </button>
      {editing && <EditSheet caps={t.caps} onClose={() => setEditing(false)} />}
    </div>
  )
}

/** Bearbeiten wie bei Banking-Apps: Reihenfolge ziehen, entfernen, hinzufügen. */
function EditSheet({ onClose, caps }: { onClose: () => void; caps: Capabilities | null }) {
  const mods = useModules()
  const navigate = useNavigate()
  const { prefs, save } = useUserPrefs()
  const [items, setItems] = useState<WidgetId[]>(() => visibleLayout(prefs.dashboard, mods, caps))
  const addable = addableWidgets(items, mods, caps)

  function commit(next: WidgetId[]) {
    setItems(next)
    void save({ dashboard: mergeLayout(prefs.dashboard, next, mods, caps) })
  }

  // Ziehen am Griff: beim Überschreiten der halben Zeilenhöhe rückt das Element weiter
  const drag = useRef<{ index: number; startY: number; h: number } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)

  function onDown(e: ReactPointerEvent<HTMLButtonElement>, index: number) {
    const row = (e.currentTarget.closest('li') as HTMLElement | null)?.getBoundingClientRect()
    drag.current = { index, startY: e.clientY, h: (row?.height ?? 56) + 8 }
    setDragging(index)
    setOffset(0)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (!d) return
    let dy = e.clientY - d.startY
    // Indizes vorher festhalten: der Updater läuft erst später
    const from = d.index
    if (dy > d.h / 2 && from < items.length - 1) {
      setItems((l) => moveItem(l, from, from + 1))
      d.index = from + 1
      d.startY += d.h
      dy -= d.h
    } else if (dy < -d.h / 2 && from > 0) {
      setItems((l) => moveItem(l, from, from - 1))
      d.index = from - 1
      d.startY -= d.h
      dy += d.h
    }
    setDragging(d.index)
    setOffset(dy)
  }
  function onUp() {
    if (!drag.current) return
    drag.current = null
    setDragging(null)
    setOffset(0)
    setItems((l) => {
      void save({ dashboard: mergeLayout(prefs.dashboard, l, mods, caps) })
      return l
    })
  }

  return (
    <PremiumSheet
      title="Heute anpassen"
      subtitle="Ziehen zum Sortieren"
      leading={
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
          <LayoutGrid size={18} />
        </span>
      }
      onClose={onClose}
      bodyClassName="space-y-5"
      footer={
        <button className="btn-primary w-full rounded-2xl py-3" onClick={onClose}>
          Fertig
        </button>
      }
    >
      <ul className="space-y-2" aria-label="Widgets auf Heute">
        {items.map((id, i) => {
          const w = widgetDef(id)
          const isDrag = dragging === i
          return (
            <li
              key={id}
              className={`flex items-center gap-3 rounded-2xl bg-cream p-2.5 pl-3 ${isDrag ? 'relative z-10 shadow-xl ring-1 ring-brand/30' : 'transition-transform'}`}
              style={isDrag ? { transform: `translateY(${offset}px) scale(1.02)` } : undefined}
            >
              <button
                aria-label={`${w.label} entfernen`}
                className="shrink-0 text-red-500 transition active:scale-90"
                onClick={() => commit(items.filter((x) => x !== id))}
              >
                <MinusCircle size={22} />
              </button>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{w.label}</span>
                <span className="block truncate text-xs text-cocoa-light">{w.hint}</span>
              </span>
              <button
                aria-label={`${w.label} verschieben`}
                className="grid h-10 w-9 shrink-0 cursor-grab touch-none place-items-center text-cocoa-muted active:cursor-grabbing"
                onPointerDown={(e) => onDown(e, i)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' && i > 0) commit(moveItem(items, i, i - 1))
                  if (e.key === 'ArrowDown' && i < items.length - 1) commit(moveItem(items, i, i + 1))
                }}
              >
                <GripVertical size={18} />
              </button>
            </li>
          )
        })}
      </ul>

      {addable.length > 0 && (
        <section className="space-y-2">
          <span className="label">Hinzufügen</span>
          <ul className="space-y-2">
            {addable.map((w) => (
              <li key={w.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3 text-left transition active:scale-[0.99]"
                  onClick={() => commit([...items, w.id])}
                >
                  <PlusCircle size={22} className="shrink-0 text-success" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{w.label}</span>
                    <span className="block truncate text-xs text-cocoa-light">{w.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3.5 text-left"
        onClick={() => {
          onClose()
          navigate('/profile?s=modules')
        }}
      >
        <SlidersHorizontal size={18} className="text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Bereiche ein- und ausblenden</span>
          <span className="block text-xs text-cocoa-light">Ernährung, Community, Smartwatch</span>
        </span>
      </button>
    </PremiumSheet>
  )
}
