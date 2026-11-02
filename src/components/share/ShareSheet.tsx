import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Share2 } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { InfoTip } from '../ui/InfoTip'
import { MyBuddy } from '../buddy/MyBuddy'
import type { BuddyMood } from '../../lib/buddyMood'
import type { ShareContent, ShareStyle } from '../../lib/shareCard'
import { renderShare } from '../../lib/shareRender'
import { svgToImage } from '../../lib/storyCard'
import { blobToBase64, shareFile, shareOutcomeText } from '../../lib/shareFile'
import { isNative, saveImageToGallery } from '../../lib/native'
import { track } from '../../lib/track'

const STYLES: { id: ShareStyle; label: string }[] = [
  { id: 'card', label: 'Buddy-Karte' },
  { id: 'clean', label: 'Clean' },
  { id: 'story', label: 'Story' },
]
const KEY = 'share_style'

function loadStyle(): ShareStyle {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'card' || v === 'clean' || v === 'story') return v
  } catch {
    /* ignore */
  }
  return 'card'
}

/** Schachbrett zeigt: hier ist das Bild durchsichtig. */
const CHECKER = {
  backgroundColor: '#3a3f4b',
  backgroundImage:
    'linear-gradient(45deg,#4a5060 25%,transparent 25%),linear-gradient(-45deg,#4a5060 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#4a5060 75%),linear-gradient(-45deg,transparent 75%,#4a5060 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
}

/** Teilen-Bild wählen (Buddy-Karte, Clean, Story), Vorschau, teilen oder in die Galerie. */
export function ShareSheet({
  content,
  mood = 'proud',
  filename,
  onClose,
}: {
  content: ShareContent
  mood?: BuddyMood
  filename: string
  onClose: () => void
}) {
  const [style, setStyle] = useState<ShareStyle>(loadStyle)
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const buddyRef = useRef<HTMLDivElement>(null)
  const native = isNative()

  useEffect(() => {
    try {
      localStorage.setItem(KEY, style)
    } catch {
      /* ignore */
    }
    let alive = true
    let url = ''
    setPreview(null)
    const t = setTimeout(async () => {
      const svg = buddyRef.current?.querySelector('svg') ?? null
      const img = svg ? await svgToImage(svg) : null
      const blob = await renderShare(style, content, img)
      if (!alive) return
      url = URL.createObjectURL(blob)
      setPreview({ url, blob })
    }, 80)
    return () => {
      alive = false
      clearTimeout(t)
      if (url) URL.revokeObjectURL(url)
    }
  }, [style, content])

  async function share() {
    if (!preview) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await shareFile(preview.blob, `${filename}-${style}.png`, { title: content.title })
      if (r === 'shared') track('share', { style })
      setMsg(shareOutcomeText(r))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!preview) return
    setBusy(true)
    try {
      const ok = await saveImageToGallery(await blobToBase64(preview.blob), `${filename}-${style}-${Date.now()}.png`)
      if (ok) track('share', { style, saved: true })
      setMsg(ok ? 'In der Galerie gespeichert (Bilder › Fitness).' : 'Speichern ging nicht – nutz „Teilen“.')
    } finally {
      setBusy(false)
    }
  }

  const transparent = style !== 'story'

  return (
    <PremiumSheet
      title="Teilen"
      subtitle="Wähl deinen Look"
      onClose={onClose}
      z="z-[70]"
      footer={
        <div className={native ? 'grid grid-cols-2 gap-2' : ''}>
          {native && (
            <button
              className="btn w-full gap-2 rounded-2xl bg-sand py-3 text-cocoa"
              onClick={save}
              disabled={!preview || busy}
            >
              <Download size={18} /> Speichern
            </button>
          )}
          <button className="btn-primary w-full gap-2 rounded-2xl py-3" onClick={share} disabled={!preview || busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Teilen
          </button>
        </div>
      }
    >
      {/* unsichtbarer Buddy als Vorlage für das Bild */}
      <div ref={buddyRef} className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <MyBuddy size={520} mood={style === 'clean' ? 'happy' : mood} animate={false} />
      </div>

      <div className="flex gap-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            aria-pressed={style === s.id}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition active:scale-95 ${
              style === s.id ? 'bg-cocoa text-bg' : 'bg-sand text-cocoa-light'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        className={`relative mx-auto overflow-hidden rounded-2xl ${
          style === 'story'
            ? 'aspect-[9/16] w-[62%]'
            : style === 'card'
              ? 'aspect-[108/100] w-full'
              : 'aspect-[108/58] w-full'
        }`}
        style={transparent ? CHECKER : undefined}
      >
        {preview ? (
          <img src={preview.url} alt="Vorschau" className="anim-fade absolute inset-0 h-full w-full object-contain" />
        ) : (
          <Loader2 className="absolute left-1/2 top-1/2 -ml-3 -mt-3 animate-spin text-white/70" />
        )}
      </div>

      {transparent && (
        <InfoTip
          className="text-center text-xs text-cocoa-muted"
          info="Das Bild ist durchsichtig. So legst du es auf dein Foto: Instagram-Story öffnen, Foto wählen, oben auf Sticker › Foto tippen und dieses Bild aus der Galerie nehmen. Dann groß ziehen und platzieren."
        >
          Durchsichtig – zum Drüberlegen in deiner Story
        </InfoTip>
      )}
      {msg && <p className="text-center text-xs text-cocoa-light">{msg}</p>}
    </PremiumSheet>
  )
}
