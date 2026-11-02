import { useState } from 'react'
import { Bookmark, LoaderCircle, Plus, X } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { GroupLabel } from '../ui/GroupList'
import { fmtInt } from '../../lib/nutritionHome'
import {
  defaultMealName,
  itemsFromEntries,
  savedMealTotals,
  sortSavedMeals,
  type SavedMeal,
} from '../../lib/savedMeals'
import { useAddSavedMeal, useDeleteSavedMeal, useSavedMeals } from '../../hooks/useSavedMeals'
import type { FoodEntry, Meal } from '../../types'

/** Fragt nur nach dem Namen und speichert die Einträge einer Mahlzeit als Vorlage. */
export function SaveMealSheet({
  meal,
  entries,
  onClose,
  onSaved,
}: {
  meal: Meal
  entries: FoodEntry[]
  onClose: () => void
  onSaved?: (name: string) => void
}) {
  const { data: saved = [] } = useSavedMeals()
  const add = useAddSavedMeal()
  const [name, setName] = useState(() =>
    defaultMealName(
      meal,
      saved.map((m) => m.name),
    ),
  )
  const kcal = savedMealTotals(itemsFromEntries(entries)).kcal

  async function submit() {
    const n = name.trim().slice(0, 60)
    if (!n || add.isPending) return
    try {
      await add.mutateAsync({ name: n, meal, items: itemsFromEntries(entries) })
      onSaved?.(n)
      onClose()
    } catch {
      /* Fehler steht unten */
    }
  }

  return (
    <Sheet title="Als Mahlzeit speichern" onClose={onClose}>
      <p className="text-sm text-cocoa-light">
        {entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'} · {fmtInt(kcal)} kcal — später mit einem Tipp
        eintragen.
      </p>
      <input
        className="input"
        autoFocus
        maxLength={60}
        aria-label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        enterKeyHint="done"
      />
      {add.error && <p className="text-sm text-red-500 dark:text-red-400">{(add.error as Error).message}</p>}
      <button className="btn-primary w-full gap-1.5" onClick={submit} disabled={add.isPending || !name.trim()}>
        {add.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Bookmark size={16} />}
        Speichern
      </button>
    </Sheet>
  )
}

/** Chips „Mein Frühstück · 520 kcal“ – Tipp trägt alles ein; „Bearbeiten“ zeigt ein × zum Löschen. */
export function SavedMealChips({
  meal,
  busy,
  onPick,
}: {
  /** Mahlzeit, zu der gerade hinzugefügt wird (passende zuerst) */
  meal: Meal | null
  busy?: boolean
  onPick: (m: SavedMeal) => void
}) {
  const { data: saved = [] } = useSavedMeals()
  const del = useDeleteSavedMeal()
  const [edit, setEdit] = useState(false)
  if (saved.length === 0) return null
  const list = sortSavedMeals(saved, meal)

  return (
    <div>
      <GroupLabel
        right={
          <button className="text-xs font-semibold text-brand" onClick={() => setEdit((v) => !v)}>
            {edit ? 'Fertig' : 'Bearbeiten'}
          </button>
        }
      >
        Meine Mahlzeiten
      </GroupLabel>
      <div className="flex flex-wrap gap-2">
        {list.map((m) => {
          const t = savedMealTotals(m.items)
          return (
            <span key={m.id} className="relative">
              <button
                disabled={busy || edit}
                onClick={() => onPick(m)}
                className="flex max-w-full items-center gap-1.5 rounded-full bg-cream py-1.5 pl-1.5 pr-3 text-sm transition active:scale-95 disabled:opacity-100"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand text-brand">
                  <Plus size={14} strokeWidth={2.5} />
                </span>
                <span className="max-w-[11rem] truncate font-medium">{m.name}</span>
                <span className="tabular shrink-0 text-xs text-cocoa-muted">· {fmtInt(t.kcal)} kcal</span>
              </button>
              {edit && (
                <button
                  className="anim-fade absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-cocoa text-bg shadow"
                  aria-label={`„${m.name}“ löschen`}
                  onClick={() => del.mutate(m.id)}
                >
                  <X size={13} strokeWidth={3} />
                </button>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
