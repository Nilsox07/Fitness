import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { useAllSets } from '../../hooks/useWorkouts'
import { useExercises, useCreateExercise } from '../../hooks/useExercises'
import { useAddFoodEntry, useFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import { useSetGymStatus } from '../../hooks/useSocial'
import { usePrefs } from '../../lib/prefs'
import { assistant, type AssistantAction, type ChatMsg } from '../../lib/ai'
import { trainingSummary } from '../../lib/analytics'
import { sumEntries } from '../../lib/nutrition'
import type { Meal } from '../../types'
import { MicButton } from '../MicButton'
import { Buddy } from './Buddy'

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

export interface BuddyChatState {
  messages: ChatMsg[]
  input: string
  setInput: (v: string | ((v: string) => string)) => void
  busy: boolean
  send: () => Promise<void>
  suggestions: string[]
  inputRef: RefObject<HTMLInputElement>
  endRef: RefObject<HTMLDivElement>
}

/**
 * Chat-Logik des Buddys (KI-Assistent): Kontext, Senden, Aktionen ausführen
 * (navigieren, Gym-Status, Essen loggen, Übung anlegen).
 * `onNavigate` wird nach einer Navigations-Aktion aufgerufen (z. B. Sheet schließen).
 */
export function useBuddyChat(onNavigate?: () => void): BuddyChatState {
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
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  // Neue Nachricht / Tipp-Anzeige → ans Ende scrollen
  useEffect(() => {
    if (messages.length || busy) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, busy])

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

  async function runAction(action: AssistantAction): Promise<string | null> {
    switch (action.type) {
      case 'navigate':
        navigate(action.to)
        onNavigate?.()
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

  const suggestions = [
    ...(showNutrition ? ['Logg 200 g Magerquark und eine Banane', 'Wie viele Kalorien hab ich noch heute?'] : []),
    'Leg die Übung Kniebeugen an, 5er-Schritte 20–120',
    'Bring mich zur Auswertung',
    'Ich gehe heute um 18 Uhr ins Gym',
  ]

  return { messages, input, setInput, busy, send, suggestions, inputRef, endRef }
}

/** Nachrichtenverlauf (Blasen + Tipp-Anzeige). */
export function BuddyChatMessages({
  chat,
  stage,
  skin,
}: {
  chat: BuddyChatState
  stage: number
  skin: string
}) {
  return (
    <>
      {chat.messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="anim-fade flex justify-end">
            <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-brand px-4 py-2.5 text-[15px] leading-snug text-on-brand">
              {m.content}
            </div>
          </div>
        ) : (
          <div key={i} className="anim-fade flex items-end gap-2">
            <Buddy
              size={26}
              mood={m.content.startsWith('⚠️') ? 'sad' : 'happy'}
              stage={stage}
              skin={skin}
              animate={false}
              className="mb-0.5 shrink-0"
            />
            <div
              className={`max-w-[80%] whitespace-pre-wrap break-words rounded-3xl rounded-bl-lg px-4 py-2.5 text-[15px] leading-snug ${
                m.content.startsWith('⚠️')
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'bg-cream text-cocoa'
              }`}
            >
              {m.content}
            </div>
          </div>
        ),
      )}

      {chat.busy && (
        <div className="anim-fade flex items-end gap-2" role="status" aria-label="Buddy tippt">
          <Buddy size={26} mood="focus" stage={stage} skin={skin} className="mb-0.5 shrink-0" />
          <div className="flex items-center gap-1 rounded-3xl rounded-bl-lg bg-cream px-4 py-3.5">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="h-2 w-2 animate-bounce rounded-full bg-cocoa-muted"
                style={{ animationDelay: `${d * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}
      <div ref={chat.endRef} />
    </>
  )
}

/** Eingabezeile mit Vorschlags-Chips, Mikrofon und Senden. */
export function BuddyChatComposer({ chat }: { chat: BuddyChatState }) {
  const { input, setInput, busy, send, suggestions, inputRef } = chat
  return (
    <>
      {/* Vorschläge als Chips */}
      {!input && !busy && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5" aria-label="Vorschläge">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setInput(s)
                inputRef.current?.focus()
              }}
              className="shrink-0 rounded-full bg-cream px-3.5 py-2 text-[13px] font-medium text-cocoa ring-1 ring-sand-dark/60 transition active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-sand-light py-1 pl-4 pr-1 ring-1 ring-sand-dark focus-within:ring-2 focus-within:ring-brand">
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent py-2 text-base text-cocoa outline-none placeholder:text-cocoa-muted"
            placeholder="Schreib Buddy…"
            aria-label="Nachricht an Buddy"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <MicButton variant="round" onResult={(t) => setInput((v) => (v ? v + ' ' + t : t))} />
        </div>
        <button
          type="submit"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-on-brand shadow-lg shadow-brand/25 transition active:scale-90 disabled:opacity-40 disabled:shadow-none"
          disabled={busy || !input.trim()}
          aria-label="Senden"
        >
          <Send size={18} className="-ml-0.5" />
        </button>
      </form>
    </>
  )
}
