import { useRef, useState } from 'react'

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
export function MicButton({ onResult }: { onResult: (text: string) => void }) {
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

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Spracheingabe"
      className={`shrink-0 rounded-xl px-3 ring-1 ring-sand-dark ${
        listening ? 'animate-pulse bg-ruby text-white' : 'bg-sand-light text-cocoa'
      }`}
    >
      🎤
    </button>
  )
}
