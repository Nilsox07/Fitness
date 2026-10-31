import type { CSSProperties, ReactNode } from 'react'
import { Camera, MessageSquare, Plus, ScanBarcode, Search, Sparkles, UtensilsCrossed } from 'lucide-react'

/**
 * Schnellerfassung in einer Reihe. Mit KI: Foto · Beschreiben · Was essen? · Suchen · Mehr
 * (Barcode steckt in „Suchen“ und „Mehr“). Ohne KI: Scannen · Suchen · Mehr.
 */
export function QuickAddBar({
  aiOn,
  onPhoto,
  onDescribe,
  onSuggest,
  onScan,
  onSearch,
  onMore,
  style,
}: {
  aiOn: boolean
  /** Foto-Datei gewählt/aufgenommen */
  onPhoto: (file: File | undefined) => void
  onDescribe: () => void
  onSuggest: () => void
  onScan: () => void
  onSearch: () => void
  onMore: () => void
  style?: CSSProperties
}) {
  if (!aiOn) {
    return (
      <div className="grid grid-cols-3 gap-2" style={style}>
        <Tile icon={<ScanBarcode size={22} />} label="Scannen" onClick={onScan} primary />
        <Tile icon={<Search size={22} />} label="Suchen" onClick={onSearch} />
        <Tile icon={<Plus size={22} strokeWidth={2.25} />} label="Mehr" onClick={onMore} />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-5 gap-1.5" style={style}>
      {/* <label> öffnet direkt Kamera/Galerie — ohne Zwischen-Sheet */}
      <label className={`${tile} relative cursor-pointer bg-brand text-on-brand`}>
        <AiMark primary />
        <Camera size={21} />
        <span>Foto</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      <Tile icon={<MessageSquare size={21} />} label="Text" onClick={onDescribe} ai />
      <Tile icon={<UtensilsCrossed size={21} />} label="Ideen" onClick={onSuggest} ai />
      <Tile icon={<Search size={21} />} label="Suchen" onClick={onSearch} />
      <Tile icon={<Plus size={21} strokeWidth={2.25} />} label="Mehr" onClick={onMore} />
    </div>
  )
}

const tile =
  'flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[11px] font-semibold leading-tight transition active:scale-95'

/** Kleines Funkeln oben rechts = nutzt die KI. */
function AiMark({ primary = false }: { primary?: boolean }) {
  return (
    <Sparkles
      size={11}
      aria-hidden
      className={`absolute right-1.5 top-1.5 ${primary ? 'text-on-brand/70' : 'text-brand/60'}`}
    />
  )
}

function Tile({
  icon,
  label,
  onClick,
  primary = false,
  ai = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  primary?: boolean
  ai?: boolean
}) {
  return (
    <button
      className={`${tile} relative ${primary ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa hover:bg-sand-light'}`}
      onClick={onClick}
      aria-label={ai ? `${label} (KI)` : undefined}
    >
      {ai && <AiMark />}
      <span className={primary ? '' : 'text-brand'}>{icon}</span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
}
