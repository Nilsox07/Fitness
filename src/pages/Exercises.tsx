import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCreateExercise,
  useDeleteExercise,
  useExercises,
  useUpdateExercise,
  type ExerciseInput,
} from '../hooks/useExercises'
import { MUSCLE_GROUPS, type Exercise } from '../types'

const empty: ExerciseInput = {
  name: '',
  muscle_group: 'Brust',
  notes: null,
  target_rep_min: 4,
  target_rep_max: 8,
  increment: 2.5,
}

export default function Exercises() {
  const navigate = useNavigate()
  const { data: exercises, isLoading } = useExercises()
  const createEx = useCreateExercise()
  const updateEx = useUpdateExercise()
  const deleteEx = useDeleteExercise()

  const [editing, setEditing] = useState<Exercise | null>(null)
  const [form, setForm] = useState<ExerciseInput>(empty)
  const [open, setOpen] = useState(false)

  function startNew() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function startEdit(ex: Exercise) {
    setEditing(ex)
    setForm({
      name: ex.name,
      muscle_group: ex.muscle_group,
      notes: ex.notes,
      target_rep_min: ex.target_rep_min,
      target_rep_max: ex.target_rep_max,
      increment: ex.increment,
    })
    setOpen(true)
  }

  async function save() {
    if (!form.name.trim()) return
    // Ungültige/leere Zahlenfelder absichern (DB verlangt min>0, max>=min, increment>0)
    const repMin = Math.max(1, Math.round(form.target_rep_min) || 1)
    const repMax = Math.max(repMin, Math.round(form.target_rep_max) || repMin)
    const increment = form.increment > 0 ? form.increment : 2.5
    const clean = { ...form, target_rep_min: repMin, target_rep_max: repMax, increment }
    if (editing) {
      await updateEx.mutateAsync({ id: editing.id, ...clean })
    } else {
      await createEx.mutateAsync(clean)
    }
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Übungen</h1>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-base"
            onClick={() => navigate('/profile')}
            aria-label="Profil & Einstellungen"
          >
            ⚙️
          </button>
          <button className="btn-primary text-sm" onClick={startNew}>
            + Neu
          </button>
        </div>
      </header>

      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      <ul className="space-y-2">
        {exercises?.map((ex) => (
          <li key={ex.id} className="card flex items-center justify-between">
            <button className="flex-1 text-left" onClick={() => startEdit(ex)}>
              <div className="font-semibold">{ex.name}</div>
              <div className="text-sm text-cocoa-light">
                {ex.muscle_group} · Ziel {ex.target_rep_min}–{ex.target_rep_max} Wdh ·
                +{ex.increment} kg
              </div>
            </button>
            <button
              className="ml-2 px-2 text-cocoa-muted hover:text-red-500 dark:text-red-400"
              aria-label="Übung löschen"
              onClick={() => {
                if (confirm(`„${ex.name}" inkl. aller Sätze löschen?`)) deleteEx.mutate(ex.id)
              }}
            >
              ✕
            </button>
          </li>
        ))}
        {exercises?.length === 0 && (
          <li className="text-cocoa-light">Noch keine Übungen. Lege deine erste an.</li>
        )}
      </ul>

      {open && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">{editing ? 'Übung bearbeiten' : 'Neue Übung'}</h2>
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                autoFocus
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Muskelgruppe</label>
              <select
                className="input"
                value={form.muscle_group}
                onChange={(e) =>
                  setForm({ ...form, muscle_group: e.target.value as Exercise['muscle_group'] })
                }
              >
                {MUSCLE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Wdh min</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="input"
                  value={form.target_rep_min}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setForm({ ...form, target_rep_min: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="label">Wdh max</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="input"
                  value={form.target_rep_max}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setForm({ ...form, target_rep_max: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="label">+kg Schritt</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0.5}
                  className="input"
                  value={form.increment}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setForm({ ...form, increment: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={save}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
