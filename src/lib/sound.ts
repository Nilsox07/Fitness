// Kleine Sound-Effekte via WebAudio (kein Asset nötig). Abschaltbar.

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem('sound_off') !== '1'
  } catch {
    return true
  }
}
export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem('sound_off', on ? '0' : '1')
  } catch {
    /* ignore */
  }
}

function playTones(freqs: number[], step = 0.12) {
  if (!soundEnabled()) return
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t0 = ctx.currentTime + i * step
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + step)
      osc.start(t0)
      osc.stop(t0 + step)
    })
  } catch {
    /* Audio nicht verfügbar */
  }
}

/** Aufsteigende Fanfare beim Level-up. */
export function playLevelUp() {
  playTones([523, 659, 784, 1047], 0.13)
}

/** Kurzer „Ding" bei erledigter Quest. */
export function playChime() {
  playTones([880, 1319], 0.1)
}
