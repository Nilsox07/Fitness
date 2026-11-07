// Fortschritt → Journal: Gewohnheiten abhaken und sehen, was deinen Schlaf und deine Erholung verändert.

import { useHeroBuddy } from '../components/home/useHeroBuddy'
import { enter } from '../components/home/motion'
import { ProgressHeader, SectionLabel } from '../components/progress/ProgressHeader'
import { Hero, HeroPill } from '../components/health/ui'
import { JournalCheckIn } from '../components/journal/JournalCheckIn'
import { HabitImpactList, impactLine } from '../components/journal/HabitImpactList'
import { InfoTip } from '../components/ui/InfoTip'
import { useJournal } from '../hooks/useJournal'
import { useJournalImpacts } from '../hooks/useRecovery'
import { useUserPrefs } from '../hooks/usePrefsSync'
import { usePrefs } from '../lib/prefs'
import { localDate } from '../lib/day'
import { JOURNAL_HABITS, MIN_TOTAL, habitLabel, journalStreak, trackedHabits } from '../lib/journal'

export default function Journal() {
  const heroBuddy = useHeroBuddy('journal')
  const { hasWatch } = usePrefs()
  const { prefs, save } = useUserPrefs()
  const { data: entries = [] } = useJournal()
  const { impacts } = useJournalImpacts()
  const today = localDate()
  const streak = journalStreak(entries, today)
  const tracked = trackedHabits(prefs.journalHabits)
  const found = impacts.filter((h) => h.status === 'ready' && h.main)
  const top = found[0]
  const logged = entries.filter((e) => e.tags.length || e.feel != null).length

  const toggleHabit = (id: string) => {
    const next = tracked.includes(id) ? tracked.filter((x) => x !== id) : [...tracked, id]
    void save({ journalHabits: next })
  }

  return (
    <div className="space-y-4">
      <ProgressHeader title="Journal" subtitle={hasWatch ? 'Gewohnheiten & Schlaf' : 'Gewohnheiten & Gefühl'} />

      <Hero
        buddy={heroBuddy}
        index={1}
        overline="Journal"
        value={streak}
        unit={streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}
      >
        <p className="mt-2 text-sm font-semibold leading-snug">
          {top
            ? `${habitLabel(top.habit)}: ${impactLine(top)}`
            : logged < MIN_TOTAL
              ? `Noch ${MIN_TOTAL - logged} Tage eintragen – dann siehst du, was dich beeinflusst.`
              : 'Bisher kein deutlicher Einfluss – trag weiter ein.'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <HeroPill value={logged} label="Tage eingetragen" />
          <HeroPill value={found.length} label={found.length === 1 ? 'Einfluss gefunden' : 'Einflüsse gefunden'} />
        </div>
      </Hero>

      <section style={enter(2)}>
        <SectionLabel>Eintragen</SectionLabel>
        <div className="card">
          <JournalCheckIn />
        </div>
      </section>

      <section style={enter(3)}>
        <SectionLabel>{hasWatch ? 'Was deinen Schlaf beeinflusst' : 'Was dein Gefühl beeinflusst'}</SectionLabel>
        <HabitImpactList impacts={impacts} />
        <InfoTip
          className="mt-2 px-1 text-[11px] text-cocoa-muted"
          info={`Verglichen werden die Morgen nach Tagen mit und ohne Gewohnheit (letzte 60 Tage, je mindestens 3 Tage). ${
            hasWatch
              ? 'Gezählt werden Schlafdauer, Tiefschlaf, HRV, Ruhepuls, Tagesform und dein Gefühl.'
              : 'Ohne Uhr zählt, wie ausgeruht du dich morgens fühlst. Mit Uhr kommen Schlaf, HRV und Ruhepuls dazu.'
          } Das zeigt Zusammenhänge, keine Beweise – aber oft sehr deutliche.`}
        >
          So wird verglichen
        </InfoTip>
      </section>

      <section style={enter(4)}>
        <SectionLabel>Abgefragt</SectionLabel>
        <div className="card flex flex-wrap gap-1.5">
          {JOURNAL_HABITS.filter((h) => !h.auto).map((h) => {
            const on = tracked.includes(h.id)
            return (
              <button
                key={h.id}
                onClick={() => toggleHabit(h.id)}
                aria-pressed={on}
                title={h.hint}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                  on ? 'bg-brand/15 text-brand' : 'bg-sand text-cocoa-muted'
                }`}
              >
                {h.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 px-1 text-[11px] text-cocoa-muted">Krafttraining zählt automatisch.</p>
      </section>
    </div>
  )
}
