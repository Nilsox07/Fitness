import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { MyBuddy } from '../buddy/MyBuddy'
import { WardrobePart, type LookPart } from '../buddy/Wardrobe'
import { useBuddy, useBuddyLevel, useLookPrefs } from '../buddy/useBuddy'
import { useAchievements } from '../../hooks/useAchievements'
import { SKINS } from '../../lib/cosmetics'
import { UNLOCKS, titleLabel } from '../../lib/unlocks'
import { Sheet } from '../workout/Sheet'

const PARTS: { part: LookPart; label: string }[] = [
  { part: 'skin', label: 'Figur' },
  { part: 'variant', label: 'Farbvariante' },
  { part: 'accessory', label: 'Accessoire' },
  { part: 'background', label: 'Hintergrund' },
  { part: 'frame', label: 'Rahmen' },
  { part: 'title', label: 'Titel' },
]

const unlockLabel = (kind: string, id: string | undefined, none: string) =>
  !id || id === 'none' || id === 'normal' ? none : (UNLOCKS.find((u) => u.kind === kind && u.id === id)?.label ?? id)

/** Profil → Aussehen: App-Farbe und Buddy an einem Ort (statt Umweg über „Erfolge“). */
export function AppearanceSettings() {
  const buddy = useBuddy()
  const level = useBuddyLevel()
  const look = useLookPrefs()
  const { earned } = useAchievements()
  const [open, setOpen] = useState<LookPart | null>(null)
  const [, rerender] = useState(0)
  const ctx = { level: level.level, prestige: level.prestige, achievements: earned }

  const value: Record<LookPart, string> = {
    skin: SKINS.find((s) => s.id === look.skin)?.label ?? 'Klassik',
    variant: unlockLabel('variant', look.variant, 'Normal'),
    accessory: unlockLabel('accessory', look.accessory, 'Ohne'),
    background: unlockLabel('background', look.background, 'Ohne'),
    frame: unlockLabel('frame', look.frame, 'Ohne'),
    title: look.title && look.title !== 'none' ? titleLabel(look.title) : 'Kein Titel',
    accent: '',
    theme: '',
  }

  return (
    <>
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">App-Farbe</h2>
        <WardrobePart part="accent" ctx={ctx} stage={buddy.stage} onChange={() => rerender((n) => n + 1)} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Dein Buddy</h2>
        <div className="overflow-hidden rounded-2xl bg-cream">
          <div className="flex justify-center bg-sand/50 py-4">
            <MyBuddy size={110} mood="happy" />
          </div>
          <div className="divide-y divide-sand-dark/40">
            {PARTS.map((p) => (
              <button
                key={p.part}
                onClick={() => setOpen(p.part)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sand/60"
              >
                <span className="flex-1 text-[15px] font-semibold">{p.label}</span>
                <span className="max-w-[45%] truncate text-sm text-cocoa-light">{value[p.part]}</span>
                <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
              </button>
            ))}
          </div>
        </div>
        <p className="px-1 text-xs text-cocoa-muted">Mehr schaltest du mit Levels frei.</p>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Dunkler Modus</h2>
        <WardrobePart part="theme" ctx={ctx} stage={buddy.stage} />
      </section>

      {open && (
        <Sheet title={PARTS.find((p) => p.part === open)?.label ?? ''} onClose={() => setOpen(null)}>
          <div className="flex justify-center">
            <MyBuddy size={96} mood="happy" />
          </div>
          <WardrobePart part={open} ctx={ctx} stage={buddy.stage} onChange={() => rerender((n) => n + 1)} />
        </Sheet>
      )}
    </>
  )
}
