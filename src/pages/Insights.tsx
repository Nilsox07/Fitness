import { useHeroBuddy } from '../components/home/useHeroBuddy'
import { enter } from '../components/home/motion'
import { ProgressHeader, SectionLabel } from '../components/progress/ProgressHeader'
import { Hero, HeroPill } from '../components/health/ui'
import { InsightList } from '../components/insights/InsightList'
import { useInsights } from '../hooks/useInsights'
import { usePrefs } from '../lib/prefs'
import { INSIGHT_GROUPS } from '../lib/insights'

/** Fortschritt → Erkenntnisse: alles, was deine Daten hergeben – gruppiert. */
export default function Insights() {
  const heroBuddy = useHeroBuddy('insights')
  const { hasWatch } = usePrefs()
  const { insights, loading } = useInsights()
  const hints = insights.filter((x) => x.tone === 'hint').length
  const good = insights.filter((x) => x.tone === 'good').length
  const groups = INSIGHT_GROUPS.map((g) => ({ ...g, items: insights.filter((x) => x.group === g.key) })).filter(
    (g) => g.items.length > 0,
  )

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-sand" />

  return (
    <div className="space-y-5">
      <ProgressHeader title="Erkenntnisse" subtitle="Aus deinen Daten" />

      <Hero
        buddy={heroBuddy}
        overline="Muster in deinen Daten"
        value={insights.length}
        unit={insights.length === 1 ? 'Erkenntnis' : 'Erkenntnisse'}
      >
        {insights.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <HeroPill value={hints} label={hints === 1 ? 'Hinweis' : 'Hinweise'} />
            <HeroPill value={good} label="läuft gut" />
          </div>
        )}
      </Hero>

      {insights.length === 0 && (
        <p className="card text-sm text-cocoa-light">
          {hasWatch
            ? 'Noch zu wenig Daten. Nach ein paar Wochen mit Uhr, Training und Gewicht erscheinen hier deine Muster.'
            : 'Trage ein paar Wochen Essen und Gewicht ein – dann rechnet die App deinen echten Verbrauch aus.'}
        </p>
      )}

      {groups.map((g, i) => (
        <section key={g.key} style={enter(i + 2)}>
          <SectionLabel>{g.label}</SectionLabel>
          <InsightList items={g.items} />
        </section>
      ))}

      {insights.length > 0 && (
        <p className="px-1 text-[11px] text-cocoa-muted">Schätzungen, keine medizinische Diagnose.</p>
      )}
    </div>
  )
}
