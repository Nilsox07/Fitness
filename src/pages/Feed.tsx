import { useMemo, useState, type ReactNode } from 'react'
import { Dumbbell, Sparkles, Utensils } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { dayLabel, localDate } from '../lib/day'
import { DigestList } from '../components/feed/ActivityCard'
import { useAuthorLookup } from '../components/feed/useAuthorLookup'
import { MyBuddy } from '../components/buddy/MyBuddy'
import { FilterChips, PageHeader, SectionTitle } from '../components/community/ui'
import { buildDigest, enter, matchesFilter, type FeedFilter } from '../components/community/communityUtils'
import { useActivities, type Activity } from '../hooks/useFeed'

export default function Feed() {
  return <FeedNew />
}

/** Neues Design: Aktivitäten nach Tagen gruppiert, gleiche Karten wie in der Community. */
function FeedNew() {
  const { showNutrition } = usePrefs()
  const { user } = useAuth()
  const { data: activities, isLoading } = useActivities()
  const authorOf = useAuthorLookup()
  const [filter, setFilter] = useState<FeedFilter>('all')
  // Ernährung ausgeblendet → kein Ernährungs-Filter
  const active: FeedFilter = !showNutrition && filter === 'food' ? 'fitness' : filter

  // Gleicher ruhiger Feed wie in der Community: Freunde pro Tag gebündelt, von dir nur Höhepunkte.
  const groups = useMemo(() => {
    const out: { day: string; items: { primary: Activity; extras: Activity[] }[] }[] = []
    const filtered = (activities ?? []).filter((a) => matchesFilter(a.kind, active))
    for (const d of buildDigest(filtered, user?.id)) {
      const day = localDate(new Date(d.primary.created_at))
      const last = out[out.length - 1]
      if (last && last.day === day) last.items.push(d)
      else out.push({ day, items: [d] })
    }
    return out
  }, [activities, active, user?.id])
  const count = groups.reduce((s, g) => s + g.items.length, 0)

  const options: { value: FeedFilter; label: string; icon: ReactNode }[] = [
    { value: 'all', label: 'Alle', icon: <Sparkles size={14} /> },
    { value: 'fitness', label: 'Training', icon: <Dumbbell size={14} /> },
    ...(showNutrition ? [{ value: 'food' as const, label: 'Ernährung', icon: <Utensils size={14} /> }] : []),
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aktivitäten"
        subtitle={isLoading ? 'Lädt…' : 'Trainings deiner Freunde & deine Höhepunkte'}
        style={enter(0)}
      />

      <div style={enter(1)}>
        <FilterChips value={active} options={options} onChange={setFilter} label="Aktivitäten filtern" />
      </div>

      {groups.map((g, i) => (
        <section key={g.day} style={enter(Math.min(i, 4) + 2)}>
          <SectionTitle right={`${g.items.length}`}>{dayLabel(g.day)}</SectionTitle>
          <DigestList digests={g.items} authorOf={authorOf} />
        </section>
      ))}

      {!isLoading && count === 0 && (
        <div className="anim-fade flex flex-col items-center gap-3 rounded-2xl bg-cream px-5 py-8 text-center">
          <MyBuddy size={72} mood="sleepy" />
          <div>
            <p className="font-semibold">Noch nichts los</p>
            <p className="mt-0.5 text-sm text-cocoa-light">
              {active === 'food'
                ? 'Teile ein Rezept oder füg Freunde hinzu.'
                : 'Schließ ein Training ab oder füg Freunde hinzu.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
