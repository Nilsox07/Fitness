import { useMemo, useState } from 'react'
import { useAiStatus } from '../hooks/useAi'
import { coachChat, type ChatMsg } from '../lib/ai'
import { MicButton } from './MicButton'
import { trainingSummary } from '../lib/analytics'
import type { Exercise, SetWithDate } from '../types'

/** KI-Coach: Chat mit Datenkontext (das Wochenfazit kommt automatisch, siehe WeeklyReview). */
export function AiPanel({ sets, exercises }: { sets: SetWithDate[]; exercises: Exercise[] }) {
  const { data: ai } = useAiStatus()
  const summary = useMemo(() => trainingSummary(sets, exercises), [sets, exercises])
  const [chatOpen, setChatOpen] = useState(false)

  if (!ai?.enabled) return null

  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🤖 KI-Coach</h2>
        <button className="btn-primary text-sm" onClick={() => setChatOpen(true)}>
          💬 Coach fragen
        </button>
      </div>
      <p className="text-sm text-cocoa-light">
        Stell dem Coach Fragen zu deinem Training — z. B. „Warum stagniert mein Latzug?".
      </p>

      {chatOpen && <CoachChatModal context={summary} onClose={() => setChatOpen(false)} />}
    </section>
  )
}

function CoachChatModal({ context, onClose }: { context: unknown; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setErr(null)
    try {
      const reply = await coachChat(next, context)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black/60 p-4">
      <div className="card mx-auto flex h-full w-full max-w-md flex-col">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">💬 Coach</h3>
          <button className="px-2 text-cocoa-muted" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-cocoa-light">
              Frag mich alles zu deinem Training — z. B. „Warum stagniert mein Latzug?" oder
              „Welchen Muskel vernachlässige ich?".
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'ml-auto bg-brand text-white'
                  : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </div>
          ))}
          {busy && <p className="text-sm text-cocoa-muted">Coach denkt nach…</p>}
          {err && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {err}</p>}
        </div>

        <div className="mt-2 flex gap-2">
          <input
            className="input"
            placeholder="Deine Frage…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <MicButton onResult={(t) => setInput((v) => (v ? v + ' ' + t : t))} />
          <button className="btn-primary shrink-0" onClick={send} disabled={busy}>
            Senden
          </button>
        </div>
      </div>
    </div>
  )
}
