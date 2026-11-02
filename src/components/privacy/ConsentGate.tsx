import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { CONSENT_TEXT, consentFromMeta, hasValidConsent, makeConsent } from '../../lib/consent'
import { hashUserId, initTracking, shouldLogAppOpen, stopTracking, track } from '../../lib/track'
import { supabase } from '../../lib/supabase'
import { isNative } from '../../lib/native'
import { APP_VERSION } from '../../lib/whatsnew'
import { Hero } from '../health/ui'
import { ErrorNote } from '../ui/GroupList'
import { PrivacyContent } from '../../pages/Privacy'
import { DeleteAccountSheet } from './DeleteAccountSheet'

const OPEN_DAY_KEY = 'track_open_day'

function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Einwilligung (Gesundheitsdaten + 18+): übernimmt die Zustimmung aus der Registrierung,
 * fragt bestehende Konten einmal im Vollbild und startet die anonyme Statistik nur mit Einwilligung.
 */
export function ConsentGate() {
  const { user } = useAuth()
  const { prefs, save, source } = useUserPrefs()
  const [showPolicy, setShowPolicy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const consented = hasValidConsent(prefs.consent)
  // Erst entscheiden, wenn echte Einstellungen geladen sind (nicht nur Cache/offline)
  const loaded = source !== null
  const signupConsent = consentFromMeta(user?.user_metadata)
  const adoptSignup = loaded && !consented && hasValidConsent(signupConsent)

  // Zustimmung aus der Registrierung ins Konto übernehmen
  const adopted = useRef(false)
  useEffect(() => {
    if (!adoptSignup || !signupConsent || adopted.current) return
    adopted.current = true
    void save({ consent: signupConsent })
  }, [adoptSignup, signupConsent, save])

  // Anonyme Statistik nur mit Einwilligung
  const uid = user?.id ?? null
  useEffect(() => {
    if (!uid) return
    if (!consented) {
      if (loaded) initTracking({ enabled: false })
      return
    }
    let cancelled = false
    void hashUserId(uid)
      .then((hash) => {
        if (cancelled) return
        initTracking({
          enabled: true,
          hash,
          version: APP_VERSION,
          platform: isNative() ? 'android' : 'web',
          send: async (rows) => {
            const { error } = await supabase.from('app_events').insert(rows)
            if (error) throw error
          },
        })
        try {
          const today = localDay()
          if (shouldLogAppOpen(localStorage.getItem(OPEN_DAY_KEY), today)) {
            localStorage.setItem(OPEN_DAY_KEY, today)
            track('app_open')
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [uid, consented, loaded])

  useEffect(() => () => stopTracking(), [])

  // Intro abgeschlossen (Wechsel von „nicht durchlaufen“ zu „durchlaufen“ in dieser Sitzung)
  const wasOnboarded = useRef<boolean | null>(null)
  useEffect(() => {
    if (!loaded) return
    if (wasOnboarded.current === false && prefs.onboarded) track('onboarding_done')
    wasOnboarded.current = prefs.onboarded
  }, [loaded, prefs.onboarded])

  if (!user || !loaded || consented || adoptSignup) return null

  async function agree() {
    setBusy(true)
    setError(null)
    try {
      await save({ consent: makeConsent() })
    } catch {
      setError('Speichern hat nicht geklappt. Bitte nochmal versuchen.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-bg">
      <div className="mx-auto max-w-md space-y-4 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        {showPolicy ? (
          <>
            <button
              type="button"
              onClick={() => setShowPolicy(false)}
              className="flex items-center gap-1 text-sm font-semibold text-brand"
            >
              <ChevronLeft size={18} /> Zurück
            </button>
            <PrivacyContent />
          </>
        ) : (
          <>
            <Hero overline="Kurz bestätigen" right={<ShieldCheck size={18} className="opacity-70" />}>
              <p className="mt-1 text-2xl font-bold leading-tight tracking-tight">Deine Daten, deine Wahl</p>
              <p className="mt-1 text-sm text-bg/70 dark:text-cocoa-light">Einmalig, dann geht’s weiter.</p>
            </Hero>
            <div className="space-y-3 rounded-2xl bg-cream p-4">
              <p className="text-[15px] leading-relaxed text-cocoa">{CONSENT_TEXT}</p>
              <button type="button" onClick={() => setShowPolicy(true)} className="text-sm font-semibold text-brand">
                Datenschutzerklärung lesen
              </button>
            </div>
            <ErrorNote error={error} />
            <button type="button" className="btn-primary w-full py-3.5" onClick={() => void agree()} disabled={busy}>
              {busy ? 'Speichere…' : 'Zustimmen'}
            </button>
            <button
              type="button"
              className="w-full py-2 text-sm font-semibold text-red-500 dark:text-red-400"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
            >
              Konto löschen
            </button>
          </>
        )}
      </div>
      {deleteOpen && <DeleteAccountSheet onClose={() => setDeleteOpen(false)} />}
    </div>,
    document.body,
  )
}
