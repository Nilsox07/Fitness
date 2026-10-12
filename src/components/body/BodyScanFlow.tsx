import { useRef, useState } from 'react'
import { Camera, Check, Clock, Loader2, PenLine, Repeat, ScanLine, Shirt, Sun } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { estimateBodyFat } from '../../lib/ai'
import { fileToDataUrl } from '../../lib/image'
import { localDate } from '../../lib/day'
import { bfCategory, type BodyFatEstimate } from '../../lib/bodyScan'
import { useAddBodyScan } from '../../hooks/useBodyScans'
import { useAiStatus } from '../../hooks/useAi'
import type { NutritionSettings } from '../../types'

const CONSENT_KEY = 'body_photo_consent'

function hasConsent(): boolean {
  try {
    return !!localStorage.getItem(CONSENT_KEY)
  } catch {
    return false
  }
}

const TIPS = [
  {
    Icon: Sun,
    title: 'Licht von vorne',
    text: 'Mit dem Gesicht zum Fenster, Tageslicht. Kein Gegenlicht, keine Lampe direkt über dir.',
  },
  {
    Icon: Camera,
    title: 'Kamera auf Bauchhöhe',
    text: '1,5–2 m Abstand, gerade halten. Selbstauslöser oder Spiegel ohne Blitz.',
  },
  {
    Icon: Shirt,
    title: 'Oberkörper sichtbar',
    text: 'Oberkörper frei oder Sport-BH bzw. enges Shirt. Kopf bis Hüfte im Bild.',
  },
  {
    Icon: Clock,
    title: 'Morgens & entspannt',
    text: 'Nüchtern, gerade stehen, Bauch nicht einziehen und nicht anspannen.',
  },
  {
    Icon: Repeat,
    title: 'Immer gleich',
    text: 'Gleicher Ort, gleiche Uhrzeit, gleiche Pose – nur so ist der Vergleich ehrlich.',
  },
]

type Step = 'guide' | 'analyzing' | 'result' | 'failed' | 'manual'

/** Ablauf: Anleitung → Foto → KI-Schätzung (Bereich) → speichern. Ohne KI: Wert selbst eintragen. */
export function BodyScanFlow({
  settings,
  weightKg,
  onClose,
}: {
  settings: NutritionSettings | null | undefined
  weightKg: number | null
  onClose: () => void
}) {
  const { data: ai } = useAiStatus()
  const aiOn = !!ai?.enabled
  const add = useAddBodyScan()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('guide')
  const [consent, setConsent] = useState(hasConsent)
  const [photo, setPhoto] = useState<string | null>(null)
  const [est, setEst] = useState<BodyFatEstimate | null>(null)
  const [keepPhoto, setKeepPhoto] = useState(true)
  const [manual, setManual] = useState('')
  const [error, setError] = useState<string | null>(null)
  const today = localDate()

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const img = await fileToDataUrl(file, 1280, 0.85)
      setPhoto(img)
      if (!aiOn) {
        setStep('manual')
        return
      }
      setStep('analyzing')
      const r = await estimateBodyFat(img, {
        sex: settings?.sex,
        age: settings?.age,
        height_cm: settings?.height_cm,
        weight_kg: weightKg ?? undefined,
      })
      setEst(r)
      setStep(r.ok ? 'result' : 'failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
      setStep('guide')
    }
  }

  function pick() {
    if (aiOn && !consent) return
    if (aiOn) {
      try {
        localStorage.setItem(CONSENT_KEY, today)
      } catch {
        /* ohne Speicher: dann eben beim nächsten Mal erneut fragen */
      }
    }
    fileRef.current?.click()
  }

  async function save(values: {
    low: number
    high: number
    source: 'ai' | 'manual'
    confidence: BodyFatEstimate['confidence'] | null
  }) {
    setError(null)
    try {
      await add.mutateAsync({
        date: today,
        photo: keepPhoto ? photo : null,
        bf_low: values.low,
        bf_high: values.high,
        weight_kg: weightKg,
        confidence: values.confidence,
        source: values.source,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    }
  }

  const manualVal = parseFloat(manual.replace(',', '.'))
  const manualOk = Number.isFinite(manualVal) && manualVal >= 3 && manualVal <= 60

  const keepToggle = photo && (
    <button
      role="switch"
      aria-checked={keepPhoto}
      onClick={() => setKeepPhoto((v) => !v)}
      className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3.5 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Foto für späteren Vergleich speichern</div>
        <div className="text-xs text-cocoa-light">Privat, nur für dich sichtbar, jederzeit löschbar</div>
      </div>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${keepPhoto ? 'bg-brand' : 'bg-sand-dark'}`}>
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${keepPhoto ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )

  const errorBox = error && (
    <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
  )

  return (
    <PremiumSheet
      title={step === 'manual' ? 'Körperfett eintragen' : 'Körperfett schätzen'}
      subtitle={step === 'guide' ? 'So wird dein Foto vergleichbar' : undefined}
      leading={
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
          <ScanLine size={18} />
        </span>
      }
      onClose={onClose}
      onBack={step === 'manual' || step === 'failed' ? () => setStep('guide') : undefined}
      busy={step === 'analyzing' || add.isPending}
      footer={
        step === 'guide' ? (
          <button className="btn-primary w-full gap-2" onClick={pick} disabled={aiOn && !consent}>
            <Camera size={18} /> Foto aufnehmen oder wählen
          </button>
        ) : step === 'result' && est ? (
          <button
            className="btn-primary w-full gap-2"
            disabled={add.isPending}
            onClick={() => save({ low: est.low, high: est.high, source: 'ai', confidence: est.confidence })}
          >
            {add.isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Speichern
          </button>
        ) : step === 'manual' ? (
          <button
            className="btn-primary w-full gap-2"
            disabled={!manualOk || add.isPending}
            onClick={() => save({ low: manualVal, high: manualVal, source: 'manual', confidence: null })}
          >
            {add.isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Speichern
          </button>
        ) : step === 'failed' ? (
          <button className="btn-primary w-full gap-2" onClick={pick}>
            <Camera size={18} /> Neues Foto
          </button>
        ) : undefined
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {step === 'guide' && (
        <>
          <div className="space-y-2">
            {TIPS.map(({ Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl bg-cream p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs leading-snug text-cocoa-light">{text}</div>
                </div>
              </div>
            ))}
          </div>

          {aiOn && (
            <label className="flex items-start gap-3 rounded-2xl bg-sand/60 p-3 text-xs leading-snug text-cocoa-light">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-ruby))]"
              />
              <span>
                Ich bin einverstanden, dass mein Foto zur Schätzung an unseren KI-Anbieter (Google Gemini) übermittelt
                wird. Gespeichert wird es nur, wenn ich das möchte – privat in meinem Konto, jederzeit löschbar. Die
                Schätzung ist ein Richtwert, keine medizinische Messung.
              </span>
            </label>
          )}

          {errorBox}

          <button
            className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-cocoa-light"
            onClick={() => setStep('manual')}
          >
            <PenLine size={15} /> Wert von Waage oder Messung eintragen
          </button>
        </>
      )}

      {step === 'analyzing' && (
        <div className="space-y-4 py-2 text-center">
          {photo && (
            <div className="relative mx-auto aspect-[3/4] w-48 overflow-hidden rounded-3xl">
              <img src={photo} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 h-1/3 animate-[scan_1.6s_ease-in-out_infinite_alternate] bg-gradient-to-b from-transparent via-brand/40 to-transparent" />
            </div>
          )}
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-cocoa-light">
            <Loader2 size={16} className="animate-spin" /> Körperfett wird geschätzt …
          </p>
        </div>
      )}

      {step === 'result' && est && (
        <>
          <div className="flex items-center gap-4 rounded-3xl bg-cocoa p-4 text-bg dark:bg-sand-light dark:text-cocoa">
            {photo && <img src={photo} alt="" className="h-28 w-20 shrink-0 rounded-2xl object-cover" />}
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
                Geschätztes Körperfett
              </div>
              <div className="tabular text-4xl font-bold tracking-tight">
                {est.low}–{est.high}
                <span className="ml-1 text-lg font-semibold text-bg/60 dark:text-cocoa-light">%</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                {settings?.sex && (
                  <span className="rounded-full bg-bg/10 px-2 py-0.5 font-medium dark:bg-white/5">
                    {bfCategory((est.low + est.high) / 2, settings.sex)}
                  </span>
                )}
                <span className="rounded-full bg-bg/10 px-2 py-0.5 font-medium dark:bg-white/5">
                  Sicherheit: {est.confidence}
                </span>
              </div>
            </div>
          </div>
          {est.hints.length > 0 && (
            <div className="rounded-2xl bg-cream p-3.5">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
                Fürs nächste Foto
              </div>
              <ul className="list-disc space-y-0.5 pl-4 text-sm text-cocoa-light">
                {est.hints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {keepToggle}
          <p className="text-xs leading-snug text-cocoa-muted">
            Fotos schwanken mit Licht, Pose und Tagesform um ein paar Prozent. Aussagekräftig ist der Verlauf über
            Monate, nicht die einzelne Zahl.
          </p>
          {errorBox}
        </>
      )}

      {step === 'failed' && est && (
        <div className="space-y-3 text-center">
          {photo && <img src={photo} alt="" className="mx-auto h-40 rounded-2xl object-cover" />}
          <p className="text-sm text-cocoa-light">{est.reason}</p>
          {est.hints.length > 0 && <p className="text-xs text-cocoa-muted">{est.hints.join(' · ')}</p>}
        </div>
      )}

      {step === 'manual' && (
        <>
          {!aiOn && photo && (
            <p className="text-sm text-cocoa-light">
              Die KI-Schätzung ist gerade nicht verfügbar – trag deinen Wert ein, dein Foto wird trotzdem gespeichert.
            </p>
          )}
          <label className="block">
            <span className="label">Körperfett in %</span>
            <input
              className="input tabular text-lg"
              inputMode="decimal"
              placeholder="z. B. 18,5"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoFocus
            />
          </label>
          <p className="text-xs text-cocoa-muted">
            Zum Beispiel von einer Körperfettwaage, Caliper-Messung oder einem DEXA-Scan. Tipp: immer mit derselben
            Methode messen.
          </p>
          {keepToggle}
          {errorBox}
        </>
      )}
    </PremiumSheet>
  )
}
