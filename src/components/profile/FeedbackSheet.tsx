import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, ImagePlus, MessageSquareWarning, X } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { ErrorNote } from '../ui/GroupList'
import { InfoTip } from '../ui/InfoTip'
import { SEG_TRACK, TILE, segBtn } from './ui'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { isNative } from '../../lib/native'
import { fileToDataUrl } from '../../lib/image'
import { APP_VERSION } from '../../lib/whatsnew'
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX_CHARS,
  SCREENSHOT_MAX_CHARS,
  canSendFeedback,
  feedbackMeta,
  type FeedbackKind,
} from '../../lib/feedback'

/** Bild klein rechnen (Ziel ≤ ~300 KB). */
async function compress(file: File): Promise<string> {
  for (const [dim, q] of [
    [1080, 0.6],
    [800, 0.5],
    [600, 0.45],
  ] as const) {
    const url = await fileToDataUrl(file, dim, q)
    if (url.length <= SCREENSHOT_MAX_CHARS) return url
  }
  throw new Error('Das Bild ist zu groß.')
}

/** Feedback & Problem melden – landet in der Tabelle `feedback` (mit App-Version, Gerät, Seite). */
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [text, setText] = useState('')
  const [shot, setShot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const current = FEEDBACK_KINDS.find((k) => k.id === kind) ?? FEEDBACK_KINDS[0]

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      setShot(await compress(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bild konnte nicht gelesen werden.')
    }
  }

  async function send() {
    if (!user || !canSendFeedback(text, shot) || busy) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('feedback').insert({
      user_id: user.id,
      kind,
      text: text.trim(),
      screenshot: shot,
      meta: feedbackMeta({
        version: APP_VERSION,
        platform: isNative() ? 'android' : 'web',
        pathname,
        lang: typeof navigator !== 'undefined' ? navigator.language : null,
      }),
    })
    setBusy(false)
    if (err) {
      setError(
        /does not exist|schema cache/i.test(err.message)
          ? 'Feedback ist noch nicht eingerichtet (Migration 0040).'
          : 'Senden hat nicht geklappt. Bitte nochmal versuchen.',
      )
      return
    }
    setDone(true)
  }

  return (
    <PremiumSheet
      title="Feedback & Problem melden"
      subtitle="Wir lesen alles"
      leading={
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
          <MessageSquareWarning size={18} />
        </span>
      }
      onClose={onClose}
      busy={busy}
      bodyClassName="space-y-3"
      footer={
        done ? (
          <button type="button" className="btn-primary w-full py-3" onClick={onClose}>
            Fertig
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary w-full py-3"
            onClick={() => void send()}
            disabled={busy || !canSendFeedback(text, shot)}
          >
            {busy ? 'Sende…' : 'Senden'}
          </button>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
            <Check size={24} />
          </span>
          <p className="text-lg font-bold text-cocoa">Danke dir!</p>
          <p className="text-sm text-cocoa-light">Dein Feedback ist angekommen.</p>
        </div>
      ) : (
        <>
          <div className={`${SEG_TRACK} grid-cols-3`} role="radiogroup" aria-label="Art">
            {FEEDBACK_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => setKind(k.id)}
                className={segBtn(kind === k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <textarea
            className="input min-h-[8rem] rounded-2xl py-3 text-base"
            value={text}
            maxLength={FEEDBACK_MAX_CHARS}
            placeholder={current.placeholder}
            onChange={(e) => setText(e.target.value)}
            aria-label="Dein Feedback"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {shot ? (
            <div className="relative w-fit">
              <img src={shot} alt="Screenshot" className="h-28 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => setShot(null)}
                aria-label="Screenshot entfernen"
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-cocoa text-bg"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button type="button" className={`${TILE} w-full`} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={16} className="text-cocoa-light" /> Screenshot anhängen
            </button>
          )}
          <InfoTip
            className="text-xs text-cocoa-muted"
            info="Mitgeschickt werden App-Version, Gerätetyp (Android/Web) und die aktuelle Seite – keine Gesundheitswerte."
          >
            Version und Gerät gehen automatisch mit.
          </InfoTip>
          <ErrorNote error={error} />
        </>
      )}
    </PremiumSheet>
  )
}
