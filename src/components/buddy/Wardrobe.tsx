import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { Buddy } from './Buddy'
import { BACKDROPS, BuddyBackdrop } from './BuddyBackdrop'
import { BUDDY_SKIN_EVENT, useLookPrefs } from './useBuddy'
import {
  ACCENTS,
  SKINS,
  applyAccent,
  getAccentId,
  getDarkStyle,
  setAccentId,
  setDarkStyle,
  setLook,
} from '../../lib/cosmetics'
import {
  ACHIEVEMENTS,
  FRAME_RING,
  UNLOCKS,
  isUnlocked,
  type BuddyLookPrefs,
  type UnlockContext,
  type UnlockDef,
} from '../../lib/unlocks'
import { accessoryProps, seasonBadges } from '../../lib/seasonBadges'
import { useAuth } from '../../lib/auth'
import { shareMyLook } from '../../hooks/useSocial'

type Tab = 'skin' | 'accessory' | 'color' | 'background' | 'frame' | 'title'

const TABS: { id: Tab; label: string }[] = [
  { id: 'skin', label: 'Skins' },
  { id: 'accessory', label: 'Accessoires' },
  { id: 'color', label: 'Farben' },
  { id: 'background', label: 'Hintergrund' },
  { id: 'frame', label: 'Rahmen' },
  { id: 'title', label: 'Titel' },
]

const NONE = (kind: UnlockDef['kind'], label = 'Ohne'): UnlockDef => ({ kind, id: 'none', label, level: 1 })

function lockText(def: UnlockDef): string {
  if (def.achievement) return ACHIEVEMENTS.find((a) => a.id === def.achievement)?.label ?? 'Erfolg'
  return `Lv ${def.level}`
}

/** Garderobe: alles Freischaltbare an einem Ort, mit Vorschau am eigenen Buddy. */
export function Wardrobe({ ctx, stage, onChange }: { ctx: UnlockContext; stage: number; onChange?: () => void }) {
  const look = useLookPrefs()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('skin')
  const [accent, setAccent] = useState(getAccentId)
  const [dark, setDark] = useState(getDarkStyle)
  const st = Math.max(2, stage)

  function update(patch: Partial<BuddyLookPrefs>) {
    const nextLook = { ...look, ...patch }
    setLook(nextLook)
    if (user) void shareMyLook(user.id, nextLook)
    window.dispatchEvent(new Event(BUDDY_SKIN_EVENT))
    onChange?.()
  }

  const preview = (patch: Partial<BuddyLookPrefs>, locked: boolean) => {
    const l = { ...look, ...patch }
    return (
      <Buddy
        size={56}
        stage={st}
        skin={l.skin}
        variant={l.variant}
        {...accessoryProps(l.accessory)}
        animate={false}
        className={locked ? 'opacity-40 saturate-[.5]' : ''}
      />
    )
  }

  const tile = (key: string, def: UnlockDef, active: boolean, onPick: () => void, content: React.ReactNode) => {
    const locked = !isUnlocked(def, ctx)
    return (
      <button
        key={key}
        type="button"
        disabled={locked}
        onClick={onPick}
        aria-pressed={active}
        aria-label={locked ? `${def.label} – gesperrt (${lockText(def)})` : def.label}
        className={`relative flex flex-col items-center gap-1 rounded-2xl px-1 pb-2 pt-1.5 text-center transition ${
          active ? 'bg-brand/10 ring-2 ring-brand' : 'bg-sand'
        }`}
      >
        {content}
        <span className="w-full truncate px-0.5 text-[11px] font-semibold leading-tight text-cocoa">{def.label}</span>
        {locked && (
          <span className="-mt-0.5 w-full truncate px-0.5 text-[10px] leading-tight text-cocoa-muted">
            {lockText(def)}
          </span>
        )}
        {locked && <Lock size={12} className="absolute right-1.5 top-1.5 text-cocoa-muted" />}
        {active && !locked && (
          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-brand text-on-brand">
            <Check size={10} strokeWidth={3.5} />
          </span>
        )}
      </button>
    )
  }

  const of = (kind: UnlockDef['kind']) => UNLOCKS.filter((u) => u.kind === kind)
  const badges = seasonBadges()
  const seasonDefs: UnlockDef[] = [...ctx.achievements]
    .filter((a) => a.startsWith('season-'))
    .sort()
    .map((id) => ({
      kind: 'accessory',
      id,
      label: badges[id]?.label ?? id.replace('season-', 'Saison '),
      achievement: undefined,
      level: 1,
    }))

  return (
    <section className="space-y-3">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? 'bg-cocoa text-bg' : 'bg-sand text-cocoa-light'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'skin' && (
        <div className="grid grid-cols-4 gap-2">
          {SKINS.map((s) =>
            tile(
              s.id,
              { kind: 'skin', id: s.id, label: s.label, level: s.minLevel },
              look.skin === s.id,
              () => update({ skin: s.id }),
              preview({ skin: s.id }, !isUnlocked({ level: s.minLevel }, ctx)),
            ),
          )}
        </div>
      )}

      {tab === 'accessory' && (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[NONE('accessory'), ...of('accessory'), ...seasonDefs].map((d) =>
              tile(
                d.id,
                d,
                look.accessory === d.id,
                () => update({ accessory: d.id }),
                preview({ accessory: d.id }, !isUnlocked(d, ctx)),
              ),
            )}
          </div>
          {seasonDefs.length === 0 && (
            <p className="px-1 text-xs text-cocoa-muted">
              Saison-Anstecker gibt es für jede abgeschlossene Monats-Saison.
            </p>
          )}
        </>
      )}

      {tab === 'color' && (
        <div className="space-y-4">
          <div>
            <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
              Buddy-Variante
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[NONE('variant', 'Normal'), ...of('variant')].map((d) => {
                const id = d.id === 'none' ? 'normal' : d.id
                return tile(
                  d.id,
                  d,
                  look.variant === id,
                  () => update({ variant: id }),
                  preview({ variant: id }, !isUnlocked(d, ctx)),
                )
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">App-Farbe</h3>
            <div className="card flex flex-wrap gap-3">
              {ACCENTS.map((a) => {
                const def: UnlockDef = { kind: 'accent', id: a.id, label: a.label, level: a.minLevel }
                const locked = !isUnlocked(def, ctx)
                const active = accent === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={locked}
                    aria-pressed={active}
                    aria-label={locked ? `${a.label} – ab Level ${a.minLevel}` : a.label}
                    onClick={() => {
                      setAccent(a.id)
                      setAccentId(a.id)
                      applyAccent(a.id)
                    }}
                    className="flex w-11 flex-col items-center gap-1"
                  >
                    <span
                      className={`relative grid h-9 w-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-cream ${
                        active ? 'ring-cocoa' : 'ring-transparent'
                      } ${locked ? 'opacity-40' : ''}`}
                      style={{ background: a.swatch }}
                    >
                      {locked ? (
                        <Lock size={14} className="text-white" />
                      ) : (
                        active && <Check size={16} strokeWidth={3} className="text-white" />
                      )}
                    </span>
                    <span className="tabular text-[10px] leading-tight text-cocoa-light">
                      {locked ? `Lv ${a.minLevel}` : a.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
              Dunkles Theme
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[NONE('theme', 'Standard'), ...of('theme')].map((d) => {
                const id = d.id === 'none' ? 'default' : d.id
                const locked = !isUnlocked(d, ctx)
                const active = dark === id
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={locked}
                    aria-pressed={active}
                    onClick={() => {
                      setDark(id)
                      setDarkStyle(id as 'default' | 'midnight')
                    }}
                    className={`relative flex items-center gap-2.5 rounded-2xl p-2.5 text-left ${active ? 'bg-brand/10 ring-2 ring-brand' : 'bg-sand'}`}
                  >
                    <span
                      className={`h-9 w-9 shrink-0 rounded-xl ring-1 ring-black/10 ${locked ? 'opacity-40' : ''}`}
                      style={{
                        background:
                          id === 'midnight'
                            ? 'linear-gradient(135deg,#02040A,#16204A)'
                            : 'linear-gradient(135deg,#0B0F19,#232E44)',
                      }}
                    />
                    <span className="min-w-0 text-sm font-semibold">
                      {d.id === 'none' ? 'Standard' : 'Midnight'}
                      <span className="block text-[11px] font-normal text-cocoa-light">
                        {locked ? lockText(d) : 'wirkt im Dunkelmodus'}
                      </span>
                    </span>
                    {locked && <Lock size={12} className="absolute right-2 top-2 text-cocoa-muted" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'background' && (
        <div className="grid grid-cols-3 gap-2">
          {[NONE('background'), ...of('background')].map((d) =>
            tile(
              d.id,
              d,
              look.background === d.id,
              () => update({ background: d.id }),
              <BuddyBackdrop background={BACKDROPS[d.id] ? d.id : undefined} className="h-16 w-full rounded-xl">
                {preview({}, !isUnlocked(d, ctx))}
              </BuddyBackdrop>,
            ),
          )}
        </div>
      )}

      {tab === 'frame' && (
        <div className="grid grid-cols-4 gap-2">
          {[NONE('frame'), ...of('frame')].map((d) =>
            tile(
              d.id,
              d,
              look.frame === d.id,
              () => update({ frame: d.id }),
              <span
                className={`mt-1 grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-cream ${
                  FRAME_RING[d.id] ? `ring-[3px] ${FRAME_RING[d.id]}` : ''
                } ${isUnlocked(d, ctx) ? '' : 'opacity-40'}`}
              >
                <Buddy size={50} stage={st} skin={look.skin} variant={look.variant} animate={false} />
              </span>,
            ),
          )}
        </div>
      )}

      {tab === 'title' && (
        <div className="grid grid-cols-2 gap-2">
          {[NONE('title', 'Kein Titel'), ...of('title')].map((d) =>
            tile(
              d.id,
              d,
              look.title === d.id,
              () => update({ title: d.id }),
              <span
                className={`mt-1 rounded-full px-3 py-1 text-sm font-bold ${d.id === 'none' ? 'text-cocoa-muted' : 'bg-gold/15 text-gold'}`}
              >
                {d.id === 'none' ? '—' : d.label}
              </span>,
            ),
          )}
        </div>
      )}
    </section>
  )
}
