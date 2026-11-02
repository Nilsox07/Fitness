import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Sparkles, X } from 'lucide-react'
import { usePrefs } from '../../lib/prefs'
import { useAiStatus } from '../../hooks/useAi'
import { useAiGate } from '../../hooks/usePremium'
import { openPlusSheet } from '../../lib/premium'
import { PlusBadge } from '../premium/PlusBadge'
import { searchEntries, suggestions, type SearchEntry, type SearchSection } from '../../lib/searchIndex'
import { openBuddySheet } from '../buddy/BuddySheet'
import { openPlanWizard } from '../onboarding/Onboarding'
import { useBackClose } from '../../lib/backStack'
import { isNative } from '../../lib/native'
import { pushSupported } from '../../lib/push'
import { track } from '../../lib/track'

export const OPEN_SEARCH_EVENT = 'open-search'

/** Suche öffnen (von überall). */
export function openSearch(): void {
  track('search_used')
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))
}

/** Hält die Suche bereit – einmal in der App eingebunden. */
export function SearchHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(OPEN_SEARCH_EVENT, on)
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, on)
  }, [])
  return open ? <SearchSheet onClose={() => setOpen(false)} /> : null
}

const ORDER: SearchSection[] = ['Heute', 'Training', 'Ernährung', 'Fortschritt', 'Community', 'Einstellungen', 'Buddy']

/** Vollbild-Suche wie bei iOS: tippen → passende Funktion antippen → du bist da. */
function SearchSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { showNutrition, showSocial, hasWatch, hasCycle } = usePrefs()
  const { data: ai } = useAiStatus()
  const gate = useAiGate()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const aiOn = ai ? ai.enabled : undefined
  const mods = {
    nutrition: showNutrition,
    social: showSocial,
    watch: hasWatch,
    ai: aiOn,
    push: pushSupported || isNative(),
    cycle: hasCycle,
  }
  const results = useMemo(
    () => (q.trim() ? searchEntries(q, mods) : []),
    [q, showNutrition, showSocial, hasWatch, aiOn, hasCycle],
  ) // eslint-disable-line react-hooks/exhaustive-deps
  useBackClose(onClose)
  const sugg = suggestions(mods)

  useEffect(() => {
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function go(e: SearchEntry) {
    onClose()
    if (e.to === 'buddy') openBuddySheet()
    else if (e.to === 'intro') openPlanWizard()
    else if (e.to === 'plus') openPlusSheet()
    else navigate(e.to)
  }

  const grouped = ORDER.map((sec) => ({ sec, items: results.filter((r) => r.section === sec) })).filter(
    (g) => g.items.length,
  )

  return (
    <div className="anim-fade fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-label="Suche">
      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <label className="flex flex-1 items-center gap-2 rounded-2xl bg-sand px-3.5 py-2.5">
          <Search size={18} className="shrink-0 text-cocoa-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && results[0] && go(results[0])}
            placeholder="Suchen – z. B. Schlaf, Rezepte, Farbe"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-cocoa-muted"
            enterKeyHint="go"
            aria-label="Suchbegriff"
          />
          {q && (
            <button aria-label="Eingabe löschen" onClick={() => setQ('')} className="text-cocoa-muted">
              <X size={16} />
            </button>
          )}
        </label>
        <button className="px-1 text-[15px] font-semibold text-brand" onClick={onClose}>
          Fertig
        </button>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-5 overflow-y-auto px-4 pb-10">
        {!q.trim() ? (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Vorschläge</h2>
            <List items={sugg} onPick={go} />
          </section>
        ) : grouped.length ? (
          grouped.map((g) => (
            <section key={g.sec}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{g.sec}</h2>
              <List items={g.items} onPick={go} />
            </section>
          ))
        ) : (
          <p className="px-1 pt-4 text-center text-sm text-cocoa-light">Nichts gefunden zu „{q}“.</p>
        )}

        {q.trim() && ai?.enabled && (
          <button
            className="flex w-full items-center gap-3 rounded-2xl bg-brand/10 px-4 py-3 text-left"
            onClick={() => {
              if (!gate.requirePlus()) return
              onClose()
              openBuddySheet(q.trim())
            }}
          >
            <Sparkles size={18} className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-brand">Buddy fragen</span>
              <span className="block truncate text-xs text-cocoa-light">„{q.trim()}“</span>
            </span>
            {gate.locked && <PlusBadge />}
          </button>
        )}
      </div>
    </div>
  )
}

function List({ items, onPick }: { items: SearchEntry[]; onPick: (e: SearchEntry) => void }) {
  return (
    <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
      {items.map((e) => (
        <button
          key={e.id}
          onClick={() => onPick(e)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sand/60"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{e.label}</span>
            <span className="block truncate text-xs text-cocoa-light">{e.sub}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
        </button>
      ))}
    </div>
  )
}
