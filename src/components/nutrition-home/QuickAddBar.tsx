import type { CSSProperties, ReactNode } from 'react'
import { Camera, Plus, ScanBarcode, Search } from 'lucide-react'

/** Schnellerfassung: große Kacheln für Foto (KI), Barcode, Suche und das volle Menü. */
export function QuickAddBar({
  aiOn,
  onPhoto,
  onScan,
  onSearch,
  onMore,
  style,
}: {
  aiOn: boolean
  /** Foto-Datei gewählt/aufgenommen */
  onPhoto: (file: File | undefined) => void
  onScan: () => void
  onSearch: () => void
  onMore: () => void
  style?: CSSProperties
}) {
  return (
    <div className={`grid gap-2 ${aiOn ? 'grid-cols-4' : 'grid-cols-3'}`} style={style}>
      {aiOn && (
        // <label> öffnet direkt Kamera/Galerie — ohne Zwischen-Sheet
        <label className={`${tile} cursor-pointer bg-brand text-on-brand`}>
          <Camera size={22} />
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
      )}
      <Tile icon={<ScanBarcode size={22} />} label="Scannen" onClick={onScan} primary={!aiOn} />
      <Tile icon={<Search size={22} />} label="Suchen" onClick={onSearch} />
      <Tile icon={<Plus size={22} strokeWidth={2.25} />} label="Mehr" onClick={onMore} />
    </div>
  )
}

const tile =
  'flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition active:scale-95'

function Tile({
  icon,
  label,
  onClick,
  primary = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      className={`${tile} ${primary ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa hover:bg-sand-light'}`}
      onClick={onClick}
    >
      <span className={primary ? '' : 'text-brand'}>{icon}</span>
      {label}
    </button>
  )
}
