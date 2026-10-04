import { useState } from 'react'
import { Sheet } from '../workout/Sheet'
import { useUpdateDisplayName } from '../../hooks/useSocial'

/** Anzeigenamen ändern — erscheint in Begrüßung, Community und Aktivitäten. */
export function NameSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const [name, setName] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateDisplayName()

  async function save() {
    setError(null)
    try {
      await update.mutateAsync(name)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <Sheet title="Dein Name" onClose={onClose}>
      <p className="text-sm text-cocoa-light">
        So begrüßt dich die App, und so sehen dich deine Freunde in der Community.
      </p>
      <input
        className="input text-lg"
        value={name}
        maxLength={40}
        autoFocus
        placeholder="z. B. Jens"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void save()}
      />
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      <button
        className="btn-primary w-full"
        onClick={() => void save()}
        disabled={update.isPending || !name.trim() || name.trim() === current.trim()}
      >
        {update.isPending ? 'Speichere…' : 'Speichern'}
      </button>
    </Sheet>
  )
}
