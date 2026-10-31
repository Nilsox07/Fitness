import { useEffect, useState } from 'react'
import {
  Camera,
  CalendarCheck,
  ChefHat,
  MessageCircle,
  MessageSquare,
  ScanFace,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { PremiumSheet, SheetHero } from '../ui/PremiumSheet'
import { MyBuddy } from '../buddy/MyBuddy'
import { OPEN_PLUS_EVENT } from '../../lib/premium'
import { usePremium } from '../../hooks/usePremium'

const BENEFITS: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: Camera, title: 'Foto-Analyse', sub: 'Essen fotografieren, Buddy schätzt die Nährwerte' },
  { icon: MessageSquare, title: 'Essen beschreiben', sub: '„2 Eier und ein Brot“ – fertig geloggt' },
  { icon: ChefHat, title: 'Mahlzeit-Ideen & Pläne', sub: 'Tagespläne, Rezepte, Restaurant-Karte lesen' },
  { icon: MessageCircle, title: 'Persönlicher Chat & Briefing', sub: 'Buddy kennt deine Daten und antwortet dir' },
  { icon: CalendarCheck, title: 'KI-Wochenfazit', sub: 'Ehrliche Auswertung mit Zielen für nächste Woche' },
  { icon: ScanFace, title: 'Körperfett per Foto', sub: 'Schätzung aus deinem Körperfoto' },
]

/** Einmal einbinden: lauscht auf `open-plus` und zeigt das „Buddy Plus“-Sheet. */
export function PlusSheetHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(OPEN_PLUS_EVENT, on)
    return () => window.removeEventListener(OPEN_PLUS_EVENT, on)
  }, [])
  return open ? <PlusSheet onClose={() => setOpen(false)} /> : null
}

/** Paywall für alle KI-Funktionen. Abrechnung kommt mit dem Play-Store-Start. */
export function PlusSheet({ onClose }: { onClose: () => void }) {
  const [soon, setSoon] = useState(false)
  const { premium, testFree, setTestFree } = usePremium()
  return (
    <PremiumSheet
      title="Buddy Plus"
      onClose={onClose}
      hero={
        <SheetHero
          art={<MyBuddy size={88} mood="cheer" />}
          title={
            <span className="inline-flex items-center gap-2">
              Buddy Plus
              <Sparkles size={20} className="text-brand" />
            </span>
          }
          subtitle="Dein Buddy mit KI – persönlich für dich"
        />
      }
      footer={
        <>
          {soon && (
            <p className="anim-fade text-center text-sm font-medium text-cocoa-light" role="status">
              Kommt mit dem Play-Store-Start.
            </p>
          )}
          <button
            className="btn-primary w-full rounded-2xl py-3.5 text-base shadow-lg shadow-brand/25"
            onClick={() => setSoon(true)}
            disabled={soon}
          >
            {soon ? 'Bald verfügbar' : 'Plus freischalten'}
          </button>
          <button className="btn-ghost w-full rounded-2xl py-3 text-sm" onClick={onClose}>
            Später
          </button>
        </>
      }
    >
      <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
        {BENEFITS.map(({ icon: Icon, title, sub }) => (
          <li key={title} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-snug text-cocoa">{title}</span>
              <span className="block text-xs leading-snug text-cocoa-light">{sub}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="px-1 text-center text-xs text-cocoa-muted">
        Training, Ernährung, Rezepte, Uhr & Community bleiben kostenlos.
      </p>
      {testFree && !premium && (
        <button className="mx-auto block text-xs font-semibold text-brand" onClick={() => setTestFree(false)}>
          Test beenden – wieder alles freischalten
        </button>
      )}
    </PremiumSheet>
  )
}
