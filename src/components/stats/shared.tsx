import { accentColor } from '../../lib/cosmetics'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTheme } from '../../lib/theme'

/** Diagramm-Farben passend zum aktiven Theme (wie bisher in der Auswertung). */
export function useChartTheme() {
  const dark = useTheme().resolved === 'dark'
  const c = {
    grid: dark ? '#243044' : '#E5E7EB',
    axis: dark ? '#94A3B8' : '#5B6472',
    muted: dark ? '#64748B' : '#8A92A0',
    tipBg: dark ? '#161D2B' : '#FFFFFF',
    tipBorder: dark ? '#344155' : '#D2D6DD',
    tipText: dark ? '#E5E9F0' : '#0B0F19',
    primary: accentColor(),
  }
  return {
    ...c,
    axisStyle: { fontSize: 11, fill: c.axis },
    tooltip: {
      contentStyle: {
        background: c.tipBg,
        border: `1px solid ${c.tipBorder}`,
        color: c.tipText,
        borderRadius: 8,
        fontSize: 12,
      },
      labelStyle: { color: c.tipText },
      cursor: { fill: dark ? 'rgba(148,163,184,0.12)' : 'rgba(91,100,114,0.08)' },
    },
  }
}

export const nf = (n: number, digits = 0) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

/** Signierte Zahl mit echtem Minuszeichen, z. B. „−0,6". */
export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${nf(Math.abs(n), digits)}`

/** Veränderung ggü. dem Vorzeitraum — steigend grün, fallend neutral (kein Rot). */
export function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[11px] text-cocoa-muted">–</span>
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  return (
    <span
      className={`tabular inline-flex items-center gap-0.5 text-[11px] font-semibold ${
        pct > 0 ? 'text-good' : 'text-cocoa-light'
      }`}
    >
      <Icon size={12} />
      {nf(Math.abs(pct))} %
    </span>
  )
}
