import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

/** Vollbild-Kamera, die 1D-Barcodes (EAN/UPC) erkennt. */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cb = useRef(onDetected)
  cb.current = onDetected
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ])
    const reader = new BrowserMultiFormatReader(hints)
    let controls: { stop: () => void } | undefined
    let cancelled = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, c) => {
        if (c && !controls) controls = c
        if (result) {
          controls?.stop()
          cb.current(result.getText())
        }
      })
      .then((c) => {
        controls = c
        if (cancelled) c.stop()
      })
      .catch((e) => setError('Kamera nicht verfügbar: ' + (e?.message ?? String(e))))

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/90 p-4">
      <div className="flex justify-end">
        <button className="btn-ghost" onClick={onClose}>
          Schließen
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        {error ? (
          <p className="px-6 text-center text-sm text-red-400">{error}</p>
        ) : (
          <div className="w-full">
            <video
              ref={videoRef}
              className="w-full rounded-xl ring-2 ring-white/30"
              autoPlay
              muted
              playsInline
            />
            <p className="mt-3 text-center text-sm text-white/80">Barcode in den Rahmen halten…</p>
          </div>
        )}
      </div>
    </div>
  )
}
