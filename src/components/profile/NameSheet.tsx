import { useState } from 'react'
import { PencilLine } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { BIG_INPUT, ErrorNote } from '../ui/GroupList'
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
    <PremiumSheet
      title="Dein Name"
      subtitle="Begrüßung & Community"
      leading={
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
          <PencilLine size={18} />
        </span>
      }
      onClose={onClose}
      busy={update.isPending}
      bodyClassName="space-y-3"
      footer={
        <button
          className="btn-primary w-full py-3"
          onClick={() => void save()}
          disabled={update.isPending || !name.trim() || name.trim() === current.trim()}
        >
          {update.isPending ? 'Speichere…' : 'Speichern'}
        </button>
      }
    >
      <p className="text-sm text-cocoa-light">
        So begrüßt dich die App, und so sehen dich deine Freunde in der Community.
      </p>
      <input
        className={`${BIG_INPUT} text-lg`}
        value={name}
        maxLength={40}
        autoFocus
        placeholder="z. B. Jens"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void save()}
      />
      <ErrorNote error={error} />
    </PremiumSheet>
  )
}
