import { useState } from 'react'
import { Check } from 'lucide-react'
import { MyBuddy } from './buddy/MyBuddy'
import { PremiumSheet, SheetHero } from './ui/PremiumSheet'
import { APP_VERSION, RELEASES, lastSeenVersion, markSeen } from '../lib/whatsnew'

/** Zeigt beim ersten Öffnen nach einem Update die neuen Features. */
export function WhatsNew() {
  const [open, setOpen] = useState(() => {
    const seen = lastSeenVersion()
    return seen !== APP_VERSION
  })

  if (!open) return null
  const release = RELEASES.find((r) => r.version === APP_VERSION) ?? RELEASES[0]
  if (!release) return null

  function close() {
    markSeen()
    setOpen(false)
  }

  return (
    <PremiumSheet
      title={release.title}
      onClose={close}
      hero={
        <SheetHero
          art={<MyBuddy size={88} mood="cheer" />}
          title={release.title}
          subtitle={`Version ${release.version} · das ist neu`}
        />
      }
      footer={
        <button className="btn-primary w-full rounded-2xl py-3.5 text-base shadow-lg shadow-brand/25" onClick={close}>
          Los geht's
        </button>
      }
    >
      {release.groups.map((g, gi) => (
        <section key={g.title} style={{ animation: 'fade-in .3s ease-out both', animationDelay: `${100 + gi * 60}ms` }}>
          <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{g.title}</h3>
          <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
            {g.items.map((it, i) => (
              <li key={i} className="flex gap-3 px-4 py-3 text-[15px] leading-snug text-cocoa">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="min-w-0">{it}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PremiumSheet>
  )
}
