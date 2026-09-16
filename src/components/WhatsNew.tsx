import { useState } from 'react'
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4">
      <div className="card mx-auto flex h-full w-full max-w-md flex-col">
        <div className="mb-2 text-center">
          <div className="text-3xl">🎉</div>
          <h2 className="text-lg font-bold">{release.title}</h2>
          <p className="text-xs text-cocoa-light">Version {release.version} · das ist neu</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          {release.groups.map((g) => (
            <div key={g.title}>
              <div className="mb-1 font-semibold">{g.title}</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-cocoa-light">
                {g.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button className="btn-primary mt-2 w-full" onClick={close}>
          Los geht's 💪
        </button>
      </div>
    </div>
  )
}
