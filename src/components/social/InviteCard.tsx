import type { CSSProperties } from 'react'
import { CalendarClock, ChefHat, Drumstick, MessageCircle, Swords, UserPlus } from 'lucide-react'
import { MyBuddy } from '../buddy/MyBuddy'
import type { FeedWorld } from '../community/communityUtils'

/** Leerer Zustand ohne Freunde: was man gemeinsam bekommt + Einladen. */
export function InviteCard({ world, onAdd, style }: { world: FeedWorld; onAdd: () => void; style?: CSSProperties }) {
  const items =
    world === 'food'
      ? [
          { Icon: Drumstick, title: 'Eiweiß-Duell', text: 'Wer schafft diese Woche öfter sein Eiweiß-Ziel?' },
          { Icon: ChefHat, title: 'Rezepte teilen', text: 'Lieblingsrezepte tauschen und mit einem Tipp loggen.' },
          { Icon: MessageCircle, title: 'Aktivitäten', text: 'Cheat-Meals beichten, Erfolge feiern.' },
        ]
      : [
          { Icon: Swords, title: 'Wochen-Duell', text: 'Punkte für jedes Training, jeden Montag neu.' },
          { Icon: CalendarClock, title: 'Gym-Treff', text: 'Sag, wann du gehst — und verabredet euch.' },
          { Icon: MessageCircle, title: 'Aktivitäten', text: 'Rekorde & Trainings feiern, kommentieren.' },
        ]
  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={style}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
      <div className="relative space-y-4">
        <div className="flex items-center gap-3">
          <MyBuddy size={64} mood="cheer" className="shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">
              {world === 'food' ? 'Zusammen isst es sich besser' : 'Zusammen trainiert es sich besser'}
            </h2>
            <p className="text-sm text-bg/70 dark:text-cocoa-light">Lade Freunde ein — dann bekommt ihr:</p>
          </div>
        </div>
        <ul className="space-y-3">
          {items.map(({ Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg/10 text-brand dark:bg-white/5">
                <Icon size={17} />
              </span>
              <span className="text-sm">
                <span className="block font-semibold">{title}</span>
                <span className="text-bg/70 dark:text-cocoa-light">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <button className="btn-primary w-full gap-2 py-3 shadow-lg shadow-brand/30" onClick={onAdd}>
          <UserPlus size={18} />
          Freund hinzufügen
        </button>
      </div>
    </section>
  )
}
