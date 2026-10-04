import { useEffect } from 'react'
import { soundEnabled } from '../../lib/sound'

// Signale für den Intervall-Player: Pieptöne (WebAudio), Vibration, Sprachansage
// und Bildschirm-Wachhalten. Alles optional — fehlt eine API, passiert einfach nichts.

let ctx: AudioContext | null = null

/** AudioContext beim ersten Tipp anlegen/entsperren (iOS spielt sonst nichts ab). */
export function unlockAudio() {
  try {
    if (!ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctx()
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function tone(freq: number, dur: number, vol = 0.35) {
  if (!soundEnabled()) return
  try {
    unlockAudio()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    const t0 = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.start(t0)
    osc.stop(t0 + dur)
  } catch {
    /* kein Ton – egal */
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* keine Vibration – egal */
  }
}

/** Kurzer Tick bei 3-2-1. */
export function countBeep() {
  tone(660, 0.12, 0.25)
}

/** Phasenwechsel: hoch = Arbeit, tiefer = Pause. */
export function phaseBeep(kind: 'work' | 'rest') {
  tone(kind === 'work' ? 988 : 523, 0.45)
  vibrate(kind === 'work' ? [200, 80, 200] : 250)
}

export function finishBeep() {
  tone(784, 0.18)
  setTimeout(() => tone(1047, 0.4), 180)
  vibrate([120, 60, 120, 60, 300])
}

// ---- Sprachansage ----

const VOICE_KEY = 'quick_voice_off'

export function voiceEnabled(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== '1'
  } catch {
    return true
  }
}

export function setVoiceEnabled(on: boolean) {
  try {
    localStorage.setItem(VOICE_KEY, on ? '0' : '1')
  } catch {
    /* ignore */
  }
  if (!on) stopSpeaking()
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string) {
  if (!voiceEnabled() || !speechAvailable()) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('de'))
    if (voice) u.voice = voice
    u.rate = 1.05
    synth.speak(u)
  } catch {
    /* keine Sprachausgabe – egal */
  }
}

export function stopSpeaking() {
  try {
    if (speechAvailable()) window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}

// ---- Bildschirm wach halten ----

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

/** Hält den Bildschirm an, solange `active` (falls `navigator.wakeLock` existiert). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } })
      .wakeLock
    if (!active || !wl) return
    let lock: WakeLockSentinelLike | null = null
    let alive = true
    const request = () => {
      wl.request('screen')
        .then((l) => {
          if (alive) lock = l
          else void l.release().catch(() => {})
        })
        .catch(() => {})
    }
    // Nach dem Zurückkehren in den Tab ist die Sperre weg → neu anfordern.
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [active])
}
