import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { HOME_CARDS, useHomeCards } from '../../lib/homeCards'

/** Unauffälliger Knopf am Ende der Startseite + Sheet mit Schaltern für Zusatz-Karten. */
export function CustomizeHome({ area }: { area: 'food' | 'training' }) {
  const [open, setOpen] = useState(false)
  const [cards, setCard] = useHomeCards()
  return (
    <>
      <button
        className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-cocoa-light transition active:scale-95"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={15} />
        Startseite anpassen
      </button>
      {open && (
        <PremiumSheet
          title="Startseite anpassen"
          subtitle="Zusätzliche Karten ein- oder ausblenden"
          leading={
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <SlidersHorizontal size={18} />
            </span>
          }
          onClose={() => setOpen(false)}
          bodyClassName="space-y-2"
        >
          {HOME_CARDS[area].map((c) => {
            const on = !!cards[c.id]
            return (
              <button
                key={c.id}
                role="switch"
                aria-checked={on}
                onClick={() => setCard(c.id, !on)}
                className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-cocoa">{c.label}</span>
                  <span className="block text-xs text-cocoa-light">{c.hint}</span>
                </span>
                <span
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-brand' : 'bg-sand-dark'}`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                      on ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            )
          })}
        </PremiumSheet>
      )}
    </>
  )
}
