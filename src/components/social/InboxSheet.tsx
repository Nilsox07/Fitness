import { useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { markInboxSeen, useInbox, type InboxItem } from '../../hooks/useInbox'
import { useDismissPoke, useSendPoke } from '../../hooks/useSocial'
import { useBuddySkin } from '../buddy/useBuddy'
import { Avatar } from './Avatar'
import { buddyLook, firstName, timeAgo, type Person } from './format'

function line(x: InboxItem): { text: string; quote?: string } {
  switch (x.type) {
    case 'poke':
      return { text: 'hat dich angestupst', quote: x.text ?? undefined }
    case 'kudos':
      return { text: 'hat dir Kudos gegeben 👏' }
    case 'comment':
      return { text: `hat kommentiert${x.activity ? `: „${x.activity}"` : ''}`, quote: x.text }
    case 'reaction':
      return { text: `hat mit ${x.emoji} reagiert${x.activity ? ` auf „${x.activity}"` : ''}` }
  }
}

/** Nachrichten-Glocke: Anstupser, Kudos, Kommentare und Reaktionen an einem Ort. */
export function InboxSheet({
  people,
  today,
  onClose,
}: {
  people: Person[]
  today: string
  onClose: () => void
}) {
  const { items, seen } = useInbox()
  const dismiss = useDismissPoke()
  const sendPoke = useSendPoke()
  const mySkin = useBuddySkin()
  const byId = new Map(people.map((p) => [p.user_id, p]))

  // Beim Schließen gilt alles als gelesen (beim Öffnen noch „neu" markiert zeigen).
  useEffect(() => () => markInboxSeen(), [])

  return (
    <PremiumSheet
      title="Nachrichten"
      subtitle={items.length ? `${items.length} in den letzten 14 Tagen` : undefined}
      leading={
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
          <Bell size={18} />
        </span>
      }
      onClose={onClose}
      bodyClassName="space-y-2"
    >
      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-cocoa-light">
          Noch nichts Neues. Anstupser, Kommentare und Reaktionen deiner Freunde landen hier.
        </p>
      )}
      {items.map((x) => {
        const p = byId.get(x.from)
        const { text, quote } = line(x)
        const fresh = x.at > seen
        return (
          <div
            key={x.key}
            className={`flex items-start gap-3 rounded-2xl p-3 ${fresh ? 'bg-brand/5 ring-1 ring-brand/15' : 'bg-cream'}`}
          >
            <Avatar name={p?.display_name} buddy={p ? buddyLook(p, false, mySkin, today) : undefined} size={36} />
            <div className="min-w-0 flex-1 text-sm">
              <div>
                <span className="font-semibold">{firstName(p)}</span> <span className="text-cocoa-light">{text}</span>
              </div>
              {quote && <div className="mt-1 rounded-xl bg-sand px-2.5 py-1.5 text-cocoa">{quote}</div>}
              <div className="mt-1 flex items-center gap-3 text-[11px] text-cocoa-muted">
                {timeAgo(x.at)}
                {x.type === 'poke' && (
                  <button
                    className="font-semibold text-brand"
                    onClick={() => {
                      sendPoke.mutate({ toUser: x.from, text: '👋 Zurück angestupst!' })
                      dismiss.mutate(x.id)
                    }}
                  >
                    👋 Zurückstupsen
                  </button>
                )}
              </div>
            </div>
            {x.type === 'poke' && (
              <button
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-cocoa-muted"
                onClick={() => dismiss.mutate(x.id)}
                aria-label="Erledigt"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )
      })}
    </PremiumSheet>
  )
}
