import { useRef, useState } from 'react'
import { Mic } from 'lucide-react'

type SR = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void
  onerror: () => void
  onend: () => void
  start: () => void
  stop: () => void
}

function getRecognition(): SR | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SR
    webkitSpeechRecognition?: new () => SR
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

const supported = typeof window !== 'undefined' && Boolean(getRecognition())

/** Diktier-Button: nimmt deutsche Sprache auf und gibt den Text zurück. */
export function MicButton({
  onResult,
  variant = 'default',
}: {
  onResult: (text: string) => void
  /** round = kleiner runder Knopf, z. B. innerhalb einer Chat-Eingabe */
  variant?: 'default' | 'round'
}) {
  const [listening, setListening] = useState(false)
  const ref = useRef<SR | null>(null)

  if (!supported) return null

  function toggle() {
    if (listening) {
      ref.current?.stop()
      return
    }
    const rec = getRecognition()
    if (!rec) return
    ref.current = rec
    rec.lang = 'de-DE'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => onResult(e.results[0][0].transcript)
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    setListening(true)
    rec.start()
  }

  const shape =
    variant === 'round'
      ? `h-9 w-9 rounded-full ${listening ? 'bg-brand text-on-brand' : 'text-cocoa-light hover:bg-sand'}`
      : `min-h-[2.75rem] w-11 rounded-xl ${listening ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light hover:bg-sand-dark/60'}`

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? 'Spracheingabe beenden' : 'Spracheingabe'}
      aria-pressed={listening}
      title={listening ? 'Hört zu… antippen zum Beenden' : 'Diktieren'}
      className={`relative grid shrink-0 place-items-center transition-colors duration-200 active:scale-95 ${shape} ${
        variant === 'round' ? 'self-center' : 'self-stretch'
      }`}
    >
      {listening && (
        <span
          className={`pointer-events-none absolute inset-0 animate-ping bg-brand/40 ${
            variant === 'round' ? 'rounded-full' : 'rounded-xl'
          }`}
        />
      )}
      <Mic size={18} className="relative" />
    </button>
  )
}
