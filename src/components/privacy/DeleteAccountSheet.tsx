import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { BIG_INPUT, ErrorNote } from '../ui/GroupList'
import { InfoTip } from '../ui/InfoTip'
import { DELETE_WORD, deleteConfirmed } from '../../lib/consent'
import { deleteAccount } from '../../lib/account'

/**
 * Konto & Daten endgültig löschen (auch „Einwilligung widerrufen“): Bestätigung per
 * Eintippen von LÖSCHEN, danach Abmeldung → Login erscheint.
 */
export function DeleteAccountSheet({ onClose, revoke = false }: { onClose: () => void; revoke?: boolean }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = deleteConfirmed(input)

  async function run() {
    if (!ok || busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteAccount()
      // Die Abmeldung zeigt automatisch den Login.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen hat nicht geklappt.')
      setBusy(false)
    }
  }

  return (
    <PremiumSheet
      title={revoke ? 'Einwilligung widerrufen' : 'Konto & Daten löschen'}
      subtitle="Endgültig, ohne Wiederherstellung"
      leading={
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10 text-red-500 dark:text-red-400">
          <Trash2 size={18} />
        </span>
      }
      onClose={onClose}
      busy={busy}
      z="z-[70]"
      bodyClassName="space-y-3"
      footer={
        <button
          type="button"
          className="btn w-full bg-red-500 py-3 font-semibold text-white disabled:opacity-40"
          onClick={() => void run()}
          disabled={!ok || busy}
        >
          {busy ? 'Lösche…' : 'Endgültig löschen'}
        </button>
      }
    >
      {revoke && (
        <InfoTip
          className="text-sm text-cocoa"
          info="Ohne deine Einwilligung dürfen wir keine Gesundheitsdaten wie Gewicht, Training, Ernährung oder Uhr-Daten verarbeiten. Die App funktioniert ohne sie nicht – deshalb löscht der Widerruf dein Konto mit allen Daten."
        >
          Widerruf = Konto und alle Daten löschen.
        </InfoTip>
      )}
      <InfoTip
        className="text-sm text-cocoa-light"
        info="Gelöscht werden Trainings, Pläne, Ernährung, Gewicht, Körperfotos, Uhr-Daten, Zyklus, Rezepte, Community-Einträge, Feedback und die anonyme Nutzungs-Statistik. Ein Abo im Play Store kündigst du dort separat."
      >
        Alles wird gelöscht, auch Körperfotos.
      </InfoTip>
      <label className="label" htmlFor="delete-confirm">
        Tippe {DELETE_WORD} zum Bestätigen
      </label>
      <input
        id="delete-confirm"
        className={BIG_INPUT}
        value={input}
        autoComplete="off"
        autoCapitalize="characters"
        placeholder={DELETE_WORD}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void run()}
      />
      <ErrorNote error={error} />
    </PremiumSheet>
  )
}
