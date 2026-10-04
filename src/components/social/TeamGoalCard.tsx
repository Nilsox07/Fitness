import { Check, Users } from 'lucide-react'
import type { TeamGoal } from '../../lib/duel'
import { useBuddySkin } from '../buddy/useBuddy'
import { Avatar } from './Avatar'
import { buddyLook, firstName, type Person } from './format'

/** Kooperatives Wochenziel: alle Trainings zusammen gegen ein gemeinsames Ziel. */
export function TeamGoalCard({ goal, people, meId }: { goal: TeamGoal; people: Person[]; meId: string }) {
  const byId = new Map(people.map((u) => [u.user_id, u]))
  const mySkin = useBuddySkin()
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
            goal.reached ? 'bg-success text-white' : 'bg-sand text-cocoa-light'
          }`}
        >
          {goal.reached ? <Check size={16} strokeWidth={3} className="anim-check" /> : <Users size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Zusammen diese Woche</div>
          <div className="text-xs text-cocoa-light">
            {goal.reached
              ? 'Teamziel geschafft!'
              : `Noch ${goal.target - goal.done} Trainings bis zum Teamziel`}
          </div>
        </div>
        <div className="tabular shrink-0 text-lg font-bold">
          {goal.done}
          <span className="text-sm font-semibold text-cocoa-light"> / {goal.target}</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sand">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${goal.reached ? 'bg-success' : 'bg-brand'}`}
          style={{ width: `${goal.progress}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {goal.perPerson.map((p) => {
          const u = byId.get(p.user_id)
          if (!u) return null
          const isMe = p.user_id === meId
          return (
            <span
              key={p.user_id}
              className="flex items-center gap-1.5 rounded-full bg-sand py-0.5 pl-0.5 pr-2.5 text-xs"
            >
              <Avatar buddy={buddyLook(u, isMe, mySkin)} name={u.display_name} size={22} className="bg-cream" />
              <span className="font-medium">{isMe ? 'Du' : firstName(u)}</span>
              <span className="tabular font-semibold text-cocoa-light">{p.sessions}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
