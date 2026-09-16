import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAiStatus } from '../hooks/useAi'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises, useCreateExercise } from '../hooks/useExercises'
import { useAddFoodEntry, useFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useSetGymStatus } from '../hooks/useSocial'
import { assistant, type AssistantAction, type ChatMsg } from '../lib/ai'
import { trainingSummary } from '../lib/analytics'
import { sumEntries } from '../lib/nutrition'
import { MicButton } from './MicButton'
import type { Meal } from '../types'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}
function currentMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export function Assistant() {
  const { data: ai } = useAiStatus()
  const navigate = useNavigate()
  const { data: allSets } = useAllSets()
  const { data: exercises } = useExercises()
  const { data: settings } = useNutritionSettings()
  const today = todayLocal()
  const { data: entries } = useFoodEntries(today)
  const addEntry = useAddFoodEntry()
  const createEx = useCreateExercise()
  const setGym = useSetGymStatus()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const context = useMemo(() => {
    const totals = sumEntries(entries ?? [])
    return {
      ziel: settings ? { kcal: settings.kcal_target, eiweiss: settings.protein_target } : null,
      heute: { kcal: totals.kcal, eiweiss: totals.protein },
      uebungen: (exercises ?? []).map((e) => e.name),
      training: trainingSummary(allSets ?? [], exercises ?? []),
    }
  }, [entries, settings, exercises, allSets])

  if (!ai?.enabled) return null

  async function runAction(action: AssistantAction): Promise<string | null> {
    switch (action.type) {
      case 'navigate':
        navigate(action.to)
        setOpen(false)
        return null
      case 'set_gym_status':
        await setGym.mutateAsync(action.text)
        return `Gym-Status gesetzt: „${action.text}"`
      case 'log_food': {
        for (const it of action.items) {
          await addEntry.mutateAsync({
            date: today,
            name: it.name,
            amount_g: it.amount_g,
            kcal: it.kcal,
            protein: it.protein,
            carbs: it.carbs,
            fat: it.fat,
            fiber: it.fiber,
            sugar: it.sugar,
            sat_fat: it.sat_fat,
            salt: it.salt,
            barcode: null,
            meal: currentMeal(),
          })
        }
        return `${action.items.length} Eintrag/Einträge geloggt.`
      }
      case 'add_exercise': {
        const d = action.draft
        await createEx.mutateAsync({
          name: d.name,
          muscle_group: d.muscle_group,
          notes: null,
          target_rep_min: d.target_rep_min,
          target_rep_max: d.target_rep_max,
          increment: d.increment,
          unilateral: d.unilateral,
          weight_steps: d.weight_steps,
          secondary_muscles: d.secondary_muscles,
        })
        return `Übung „${d.name}" angelegt.`
      }
      default:
        return null
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const res = await assistant(next, context)
      const note = await runAction(res.action)
      const content = note ? `${res.reply}\n\n✅ ${note}` : res.reply
      setMessages((m) => [...m, { role: 'assistant', content }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Fehler'}` },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[84px] right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-brand text-2xl text-white shadow-lg"
          aria-label="KI-Assistent"
        >
          ✨
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/60 p-4">
          <div className="card mx-auto flex h-full w-full max-w-md flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold">✨ Assistent</h3>
              <button className="px-2 text-cocoa-muted" onClick={() => setOpen(false)} aria-label="Schließen">
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {messages.length === 0 && (
                <div className="space-y-2 text-sm text-cocoa-light">
                  <p>Frag mich oder gib mir Anweisungen, z. B.:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>„Logg 200 g Magerquark und eine Banane"</li>
                    <li>„Wie viele Kalorien hab ich noch heute?"</li>
                    <li>„Leg die Übung Kniebeugen an, 5er-Schritte 20–120"</li>
                    <li>„Bring mich zur Auswertung"</li>
                    <li>„Ich gehe heute um 18 Uhr ins Gym"</li>
                  </ul>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'ml-auto bg-brand text-white'
                      : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {busy && <p className="text-sm text-cocoa-muted">Denke nach…</p>}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                className="input"
                placeholder="Fragen oder Anweisung…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <MicButton onResult={(t) => setInput((v) => (v ? v + ' ' + t : t))} />
              <button className="btn-primary shrink-0" onClick={send} disabled={busy}>
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
