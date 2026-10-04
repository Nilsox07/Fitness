import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAiStatus } from '../hooks/useAi'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises, useCreateExercise } from '../hooks/useExercises'
import { useAddFoodEntry, useFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useSetGymStatus } from '../hooks/useSocial'
import { usePrefs } from '../lib/prefs'
import { assistant, type AssistantAction, type ChatMsg } from '../lib/ai'
import { trainingSummary } from '../lib/analytics'
import { sumEntries } from '../lib/nutrition'
import { Send, X } from 'lucide-react'
import { MicButton } from './MicButton'
import { Buddy } from './buddy/Buddy'
import { useBuddyLook } from './buddy/useBuddy'
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
  const { showNutrition } = usePrefs()
  const look = useBuddyLook()

  const [open, setOpen] = useState(false)

  // Geöffnet wird der Assistent über den ✨-Button in der oberen Leiste.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('open-assistant', onOpen)
    return () => window.removeEventListener('open-assistant', onOpen)
  }, [])
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const context = useMemo(() => {
    const base = {
      uebungen: (exercises ?? []).map((e) => e.name),
      training: trainingSummary(allSets ?? [], exercises ?? []),
    }
    // Ernährung ausgeblendet → keine kcal/Protein-Daten an die KI.
    if (!showNutrition) {
      return {
        ...base,
        hinweis: 'Ernährungstracking ist ausgeschaltet: keine Ernährungsdaten, kein log_food.',
      }
    }
    const totals = sumEntries(entries ?? [])
    return {
      ziel: settings ? { kcal: settings.kcal_target, eiweiss: settings.protein_target } : null,
      heute: { kcal: totals.kcal, eiweiss: totals.protein },
      ...base,
    }
  }, [entries, settings, exercises, allSets, showNutrition])

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
      let content: string
      if (res.action.type === 'log_food' && !showNutrition) {
        // Ernährungstracking ist aus → nichts loggen (auch wenn die KI es vorschlägt).
        content =
          'Ernährungstracking ist ausgeschaltet – ich habe nichts geloggt. Du kannst es im Profil unter „Ernährungstracking" einschalten.'
      } else {
        const note = await runAction(res.action)
        content = note ? `${res.reply}\n\n✅ ${note}` : res.reply
      }
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
      {open && (
        <div className="anim-fade fixed inset-0 z-40 flex flex-col bg-black/60 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="card mx-auto flex h-full w-full max-w-md flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold">
                <Buddy size={36} mood={busy ? 'focus' : 'happy'} stage={look.stage} skin={look.skin} className="-my-1.5" />
                Buddy
                <span className="text-xs font-medium text-cocoa-muted">Assistent</span>
              </h3>
              <button
                className="grid h-8 w-8 place-items-center rounded-full bg-sand text-cocoa-light"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {messages.length === 0 && (
                <div className="space-y-2 text-sm text-cocoa-light">
                  <p>Frag mich oder gib mir Anweisungen, z. B.:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {showNutrition && (
                      <>
                        <li>„Logg 200 g Magerquark und eine Banane"</li>
                        <li>„Wie viele Kalorien hab ich noch heute?"</li>
                      </>
                    )}
                    <li>„Leg die Übung Kniebeugen an, 5er-Schritte 20–120"</li>
                    <li>„Bring mich zur Auswertung"</li>
                    <li>„Ich gehe heute um 18 Uhr ins Gym"</li>
                  </ul>
                </div>
              )}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div
                    key={i}
                    className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-brand px-3 py-2 text-sm text-on-brand"
                  >
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="flex items-end gap-1.5">
                    <Buddy
                      size={28}
                      mood={m.content.startsWith('⚠️') ? 'sad' : 'happy'}
                      stage={look.stage}
                      skin={look.skin}
                      animate={false}
                      className="mb-0.5 shrink-0"
                    />
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-sand px-3 py-2 text-sm text-cocoa">
                      {m.content}
                    </div>
                  </div>
                ),
              )}
              {busy && (
                <div className="flex items-center gap-1.5 text-sm text-cocoa-muted">
                  <Buddy size={28} mood="focus" stage={look.stage} skin={look.skin} className="shrink-0" />
                  Denke nach…
                </div>
              )}
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
              <button className="btn-primary shrink-0" onClick={send} disabled={busy} aria-label="Senden">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
