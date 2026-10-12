import { useState } from 'react'
import { Handshake, Loader2, Minus, Plus } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { useCreateChallenge } from '../../hooks/useChallenges'
import { CHALLENGE_KINDS, STAKE_PRESETS, type ChallengeKind } from '../../lib/stakes'

/** Wette mit einem Freund für diese Woche: Ziel + Einsatz. */
export function StakeSheet({
  friendId,
  friendName,
  showNutrition,
  onClose,
}: {
  friendId: string
  friendName: string
  showNutrition: boolean
  onClose: () => void
}) {
  const create = useCreateChallenge()
  const kinds = CHALLENGE_KINDS.filter((k) => showNutrition || !k.nutrition)
  const [kind, setKind] = useState<ChallengeKind>('sessions')
  const [target, setTarget] = useState(4)
  const [stake, setStake] = useState(STAKE_PRESETS[0])
  const [custom, setCustom] = useState('')
  const unit = CHALLENGE_KINDS.find((k) => k.kind === kind)!.unit
  const finalStake = (custom.trim() || stake).slice(0, 60)

  async function send() {
    await create.mutateAsync({ opponent: friendId, kind, target, stake: finalStake })
    onClose()
  }

  return (
    <PremiumSheet
      title="Wette starten"
      subtitle={`Du gegen ${friendName} – diese Woche`}
      leading={
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
          <Handshake size={18} />
        </span>
      }
      onClose={onClose}
      busy={create.isPending}
      footer={
        <button className="btn-primary w-full gap-2 rounded-2xl py-3" onClick={send} disabled={create.isPending}>
          {create.isPending ? <Loader2 size={18} className="animate-spin" /> : <Handshake size={18} />}
          {friendName} herausfordern
        </button>
      }
    >
      <section className="space-y-2">
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Worum geht’s?</h3>
        <div className="flex gap-2">
          {kinds.map((k) => (
            <button
              key={k.kind}
              onClick={() => {
                setKind(k.kind)
                setTarget(k.kind === 'sessions' ? 4 : 5)
              }}
              aria-pressed={kind === k.kind}
              className={`flex-1 rounded-2xl px-2 py-2.5 text-sm font-semibold ${kind === k.kind ? 'bg-brand text-on-brand' : 'bg-cream'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3.5">
        <span className="text-sm font-semibold">Jeder schafft mindestens</span>
        <span className="flex items-center gap-2">
          <button
            aria-label="Weniger"
            className="grid h-9 w-9 place-items-center rounded-full bg-sand active:scale-90"
            onClick={() => setTarget((t) => Math.max(1, t - 1))}
          >
            <Minus size={16} />
          </button>
          <span className="tabular w-8 text-center text-xl font-bold">{target}</span>
          <button
            aria-label="Mehr"
            className="grid h-9 w-9 place-items-center rounded-full bg-sand active:scale-90"
            onClick={() => setTarget((t) => Math.min(7, t + 1))}
          >
            <Plus size={16} />
          </button>
        </span>
      </section>
      <p className="-mt-3 px-1 text-xs text-cocoa-light">{unit} bis Sonntag</p>

      <section className="space-y-2">
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Einsatz</h3>
        <div className="flex flex-wrap gap-2">
          {STAKE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setStake(p)
                setCustom('')
              }}
              aria-pressed={!custom && stake === p}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                !custom && stake === p ? 'bg-cocoa text-bg' : 'bg-cream'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          className="input rounded-2xl"
          maxLength={60}
          placeholder="Oder eigener Einsatz, z. B. Frühstück ausgeben"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      </section>

      <p className="rounded-2xl bg-sand/60 p-3 text-xs leading-snug text-cocoa-light">
        Wer bis Sonntag keine {target} {unit} schafft, schuldet dem anderen: <b className="text-cocoa">{finalStake}</b>.
        Schaffen es beide, entfällt der Einsatz. {friendName} muss die Wette erst annehmen.
      </p>
      {create.error && <p className="text-sm text-red-500">{(create.error as Error).message}</p>}
    </PremiumSheet>
  )
}
