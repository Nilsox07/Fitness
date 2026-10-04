import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Send } from 'lucide-react'
import { MicButton } from './MicButton'
import { Buddy } from './buddy/Buddy'
import { useBuddy } from './buddy/useBuddy'
import { PremiumSheet } from './ui/PremiumSheet'
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
  const buddy = useBuddy()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)

  // Geöffnet wird der Assistent über den Buddy-Button in der oberen Leiste.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('open-assistant', onOpen)
    return () => window.removeEventListener('open-assistant', onOpen)
  }, [])
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  // Neue Nachricht / Tipp-Anzeige → ans Ende scrollen
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, busy, open])

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

  const suggestions = [
    ...(showNutrition ? ['Logg 200 g Magerquark und eine Banane', 'Wie viele Kalorien hab ich noch heute?'] : []),
    'Leg die Übung Kniebeugen an, 5er-Schritte 20–120',
    'Bring mich zur Auswertung',
    'Ich gehe heute um 18 Uhr ins Gym',
  ]

  if (!open) return null

  return (
    <PremiumSheet
      title="Buddy"
      subtitle={busy ? 'tippt gerade…' : buddy.line}
      leading={
        <span className="relative grid h-11 w-11 place-items-center rounded-full bg-brand/10">
          <Buddy size={40} mood={busy ? 'focus' : buddy.mood} stage={buddy.stage} skin={buddy.skin} />
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg bg-success" />
        </span>
      }
      onClose={() => setOpen(false)}
      full
      z="z-40"
      bodyClassName="space-y-3"
      footer={
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
      }
    >
      {messages.length === 0 && (
        <div className="anim-fade flex flex-col items-center px-4 pb-2 pt-6 text-center">
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 scale-125 rounded-full bg-brand/20 blur-2xl" />
            <Buddy size={96} mood="cheer" stage={buddy.stage} skin={buddy.skin} className="relative" />
          </div>
          <p className="mt-3 text-lg font-bold tracking-tight">Hi, ich bin Buddy!</p>
          <p className="mt-1 max-w-[17rem] text-sm text-cocoa-light">
            Frag mich was oder gib mir eine Anweisung — ich logge, lege an und bringe dich hin.
          </p>
        </div>
      )}

      {messages.map((m, i) =>
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
              stage={buddy.stage}
              skin={buddy.skin}
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

      {busy && (
        <div className="anim-fade flex items-end gap-2" role="status" aria-label="Buddy tippt">
          <Buddy size={26} mood="focus" stage={buddy.stage} skin={buddy.skin} className="mb-0.5 shrink-0" />
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
      <div ref={endRef} />
    </PremiumSheet>
  )
}
