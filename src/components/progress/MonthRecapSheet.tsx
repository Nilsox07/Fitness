import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Share2 } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { MyBuddy } from '../buddy/MyBuddy'
import { useAllSets } from '../../hooks/useWorkouts'
import { useExercises } from '../../hooks/useExercises'
import { useAllFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import { useBodyWeights } from '../../hooks/useBodyWeight'
import { useMyProfile } from '../../hooks/useSocial'
import { usePrefs } from '../../lib/prefs'
import { defaultRecapMonth, monthRecap } from '../../lib/monthRecap'
import { renderMonthStory, shareImage } from '../../lib/storyCard'

const shift = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Monats-Rückblick als Story-Bild: Vorschau, dann teilen oder speichern. */
export function MonthRecapSheet({ onClose }: { onClose: () => void }) {
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultRecapMonth)
  const { data: sets } = useAllSets()
  const { data: exercises } = useExercises()
  const { data: food } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const { data: weights } = useBodyWeights()
  const { data: profile } = useMyProfile()
  const { showNutrition } = usePrefs()
  const buddyRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const recap = useMemo(() => {
    const names = new Map((exercises ?? []).map((e) => [e.id, e.name]))
    return monthRecap(month, {
      sets: sets ?? [],
      exerciseName: (id) => names.get(id),
      food: food ?? [],
      proteinTarget: settings?.protein_target ?? 0,
      weights: (weights ?? []).map((w) => ({ date: w.date, kg: Number(w.weight_kg) })),
    })
  }, [month, sets, exercises, food, settings, weights])

  useEffect(() => {
    let alive = true
    let url = ''
    const t = setTimeout(async () => {
      const blob = await renderMonthStory(recap, {
        buddySvg: buddyRef.current?.querySelector('svg') ?? null,
        name: profile?.display_name ?? null,
        nutrition: showNutrition,
      })
      if (!alive) return
      url = URL.createObjectURL(blob)
      setPreview({ url, blob })
    }, 150)
    return () => {
      alive = false
      clearTimeout(t)
      if (url) URL.revokeObjectURL(url)
    }
  }, [recap, profile?.display_name, showNutrition])

  async function share() {
    if (!preview) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await shareImage(preview.blob, `rueckblick-${month}.png`, `Mein ${recap.monthName} 💪`)
      if (r === 'downloaded') setMsg('Bild gespeichert – jetzt in Instagram oder WhatsApp als Story posten.')
    } catch {
      /* Teilen abgebrochen */
    } finally {
      setBusy(false)
    }
  }

  return (
    <PremiumSheet
      title="Monats-Rückblick"
      subtitle="Als Story teilen"
      onClose={onClose}
      footer={
        <button className="btn-primary w-full gap-2 rounded-2xl py-3" onClick={share} disabled={!preview || busy}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Teilen
        </button>
      }
    >
      {/* unsichtbarer Buddy als Vorlage für das Bild */}
      <div ref={buddyRef} className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <MyBuddy size={360} mood="proud" animate={false} />
      </div>

      <div className="flex gap-2">
        {[shift(current, -1), current].map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            aria-pressed={month === m}
            className={`flex-1 rounded-full py-2 text-sm font-semibold ${month === m ? 'bg-cocoa text-bg' : 'bg-sand text-cocoa-light'}`}
          >
            {new Date(`${m}-15T12:00:00`).toLocaleDateString('de-DE', { month: 'long' })}
          </button>
        ))}
      </div>

      <div className="mx-auto aspect-[9/16] w-[62%] overflow-hidden rounded-2xl bg-sand shadow-lg">
        {preview ? (
          <img src={preview.url} alt={`Rückblick ${recap.monthName}`} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 className="animate-spin text-cocoa-muted" />
          </div>
        )}
      </div>
      {msg && <p className="text-center text-xs text-cocoa-light">{msg}</p>}
    </PremiumSheet>
  )
}
