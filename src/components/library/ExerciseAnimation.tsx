import { useEffect, useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { imageUrl } from '../../lib/exerciseLibrary'

const FRAME_MS = 1200

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/**
 * Einfache Übungs-Animation: die zwei Fotos (Start-/Endposition) blenden im
 * Wechsel ineinander über. `still` zeigt nur das erste Bild (z. B. Listen-Thumbnail).
 * Bei „Bewegung reduzieren" bleibt die Animation stehen.
 */
export function ExerciseAnimation({
  images,
  alt,
  still = false,
  className = '',
}: {
  images: string[]
  alt: string
  still?: boolean
  className?: string
}) {
  const frames = still ? images.slice(0, 1) : images.slice(0, 2)
  const reduced = usePrefersReducedMotion()
  const [loaded, setLoaded] = useState<boolean[]>([])
  const [failed, setFailed] = useState(frames.length === 0)
  const [frame, setFrame] = useState(0)
  const key = frames.join('|')

  // Neue Übung → Zustand zurücksetzen
  useEffect(() => {
    setLoaded([])
    setFailed(frames.length === 0)
    setFrame(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const allLoaded = frames.length > 0 && frames.every((_, i) => loaded[i])
  const animate = !still && !reduced && frames.length > 1 && allLoaded && !failed

  useEffect(() => {
    if (!animate) return
    const t = window.setInterval(() => setFrame((f) => (f + 1) % frames.length), FRAME_MS)
    return () => window.clearInterval(t)
  }, [animate, frames.length])

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white ${className}`}
      role="img"
      aria-label={alt}
    >
      {!failed && !loaded[0] && <div className="absolute inset-0 animate-pulse bg-sand" aria-hidden />}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-sand text-cocoa-muted" aria-hidden>
          <Dumbbell size={still ? 18 : 32} />
        </div>
      ) : (
        frames.map((src, i) => (
          <img
            key={src}
            src={imageUrl(src)}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded((l) => Object.assign([...l], { [i]: true }))}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ease-in-out ${
              loaded[i] && (i === frame || (i === 0 && !allLoaded)) ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))
      )}
    </div>
  )
}
