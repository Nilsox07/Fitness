import { Droplet } from 'lucide-react'
import { InfoTip } from './ui/InfoTip'
import { useCycleState } from '../hooks/useCycle'
import { waterRetentionLikely } from '../lib/cycle'

/** Hinweis beim Gewicht: kurz vor/zu Beginn der Periode ist mehr Wasser normal (nur mit Zyklus-Bereich). */
export function CycleWaterNote() {
  const c = useCycleState()
  if (!waterRetentionLikely(c)) return null
  return (
    <InfoTip
      className="rounded-xl bg-gold/10 px-3 py-2 text-xs font-semibold text-cocoa"
      info="Vor und zu Beginn der Periode lagert der Körper oft 0,5–2 kg Wasser ein. Das ist kein Fett und verschwindet nach ein paar Tagen wieder – vergleich lieber Woche mit Woche."
    >
      <span className="flex items-center gap-1.5">
        <Droplet size={13} className="text-gold" /> Zyklus: etwas mehr Wasser ist gerade normal
      </span>
    </InfoTip>
  )
}
