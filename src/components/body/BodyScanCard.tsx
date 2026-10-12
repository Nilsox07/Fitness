import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ScanLine } from 'lucide-react'
import { useBodyScans } from '../../hooks/useBodyScans'
import { bfRangeLabel, photoDue } from '../../lib/bodyScan'
import { localDate } from '../../lib/day'
import { SectionTitle } from '../food-progress/ui'

/** Kompakter Einstieg in „Körper“ (Körperfett & Fotos) auf den Fortschritts-Seiten. */
export function BodyScanCard({ style }: { style?: CSSProperties }) {
  const { data: scans = [] } = useBodyScans()
  const today = localDate()
  const latest = [...scans].sort((a, b) => a.date.localeCompare(b.date)).pop()
  const due = photoDue(scans, today)

  return (
    <section style={style}>
      <SectionTitle>Körper</SectionTitle>
      <Link to="/body" className="card flex items-center gap-3 transition active:scale-[0.98]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <ScanLine size={20} />
        </span>
        <div className="min-w-0 flex-1">
          {latest ? (
            <>
              <div className="tabular text-sm font-semibold">Körperfett {bfRangeLabel(latest)}</div>
              <div className={`text-xs ${due ? 'font-semibold text-brand' : 'text-cocoa-light'}`}>
                {due ? 'Zeit für ein Vergleichsfoto' : 'Fotos & Vorher/Nachher ansehen'}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">Startfoto & Körperfett</div>
              <div className="text-xs text-cocoa-light">Ein Foto – die KI schätzt deinen Körperfettanteil</div>
            </>
          )}
        </div>
        <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
      </Link>
    </section>
  )
}
