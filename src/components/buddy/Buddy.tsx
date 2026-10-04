import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { BUDDY_MOODS, type BuddyMood } from '../../lib/buddyMood'

// Buddy — runde Begleiter-Figur (reines Inline-SVG, viewBox 0 0 120 120).
// Körperfarbe folgt der Akzentfarbe (CSS-Variablen --c-ruby*), Pupillen sind immer dunkel.

export type { BuddyMood }

/** Ab wie vielen Trainings welche Wachstumsstufe erreicht ist (wie mascotStageIndex). */
export const BUDDY_STAGE_SESSIONS = [0, 10, 30, 60, 120, 250]

/** Namen der Wachstumsstufen (wie in der Sammlung). */
export const BUDDY_STAGE_LABELS = ['Ei', 'Küken', 'im Aufbau', 'Kraftpaket', 'Athlet', 'Champion']

export interface BuddyProps {
  size?: number
  mood?: BuddyMood
  /** 0 = Ei … 5 = Champion (aus mascotStageIndex) */
  stage?: number
  /** SKINS-ID: classic | beast | robot | cat */
  skin?: string
  className?: string
  animate?: boolean
  title?: string
}

const INK = '#1B1F2A'
const BASE = 'rgb(var(--c-ruby))'
const DARK = 'rgb(var(--c-ruby-dark))'
const LIGHT = 'rgb(var(--c-ruby-light))'
const PINK = '#FF8FA3'
const GOLD = '#FBBF24'
const WATER = '#8FD0F5'

const f = (fill: string): CSSProperties => ({ fill })

const BODY = 'M60 24C84 24 98 46 99 70C100 92 84 106 60 106C36 106 20 92 21 70C22 46 36 24 60 24Z'
const EGG = 'M60 18C80 18 95 50 95 74C95 94 80 106 60 106C40 106 25 94 25 74C25 50 40 18 60 18Z'
const SCALE = [0.86, 0.78, 0.86, 0.92, 0.96, 1]

const STYLE = `
.buddy-anim .bd-breathe{transform-origin:60px 107px;animation:bd-breathe 3s ease-in-out infinite}
@keyframes bd-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
.buddy-anim .bd-blink{transform-box:fill-box;transform-origin:center;animation:bd-blink 4.2s infinite both}
@keyframes bd-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
.buddy-anim .bd-bounce{animation:bd-bounce .7s cubic-bezier(.3,0,.5,1) infinite alternate}
@keyframes bd-bounce{from{transform:translateY(0)}to{transform:translateY(-7px)}}
.buddy-anim .bd-wiggle{transform-origin:60px 106px;animation:bd-wiggle 3.2s ease-in-out infinite}
@keyframes bd-wiggle{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(-5deg)}82%{transform:rotate(5deg)}88%{transform:rotate(-3deg)}94%{transform:rotate(2deg)}}
.buddy-anim .bd-z{animation:bd-z 2.8s ease-out infinite both}
.buddy-anim .bd-z2{animation-delay:1.4s}
@keyframes bd-z{0%{opacity:0;transform:translate(0,4px)}25%{opacity:1}100%{opacity:0;transform:translate(6px,-12px)}}
.buddy-anim .bd-twinkle{transform-box:fill-box;transform-origin:center;animation:bd-twinkle 1.8s ease-in-out infinite}
.buddy-anim .bd-tw2{animation-delay:.6s}.buddy-anim .bd-tw3{animation-delay:1.2s}
@keyframes bd-twinkle{0%,100%{transform:scale(.7);opacity:.6}50%{transform:scale(1.1);opacity:1}}
.buddy-anim .bd-drop{animation:bd-drop 2.4s ease-in infinite}
@keyframes bd-drop{0%,40%{transform:translateY(0);opacity:1}100%{transform:translateY(6px);opacity:0}}
@media (prefers-reduced-motion:reduce){.buddy-anim *{animation:none!important}}
`

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    } catch {
      return
    }
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/** 4-zackiger Funkelstern. */
function star(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`
}

/** Spiegelt eine Gruppe an der vertikalen Mittelachse (x = 60). */
const MIRROR = 'translate(120 0) scale(-1 1)'

// ---------------------------------------------------------------------------
// Augen
// ---------------------------------------------------------------------------

const EYE_Y = 58
const EYES_X = [47, 73]

/** Lid: obere Ellipsenkappe bis zur Höhe frac (0 = offen, 1 = zu). */
function lidPath(cx: number, cy: number, rx: number, ry: number, frac: number): string {
  const L = cy - ry + 2 * ry * frac
  const dy = (L - cy) / ry
  const w = rx * Math.sqrt(Math.max(0, 1 - dy * dy))
  const large = L > cy ? 1 : 0
  return `M${cx - w} ${L}A${rx} ${ry} 0 ${large} 1 ${cx + w} ${L}Z`
}

function Eyes({
  mood,
  robot,
  bodyFill,
  blinkDelay,
}: {
  mood: BuddyMood
  robot: boolean
  bodyFill: string
  blinkDelay: string
}) {
  // Geschlossene, glückliche Augen (^^)
  if (mood === 'proud') {
    return (
      <g fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round">
        {EYES_X.map((x) => (
          <path key={x} d={`M${x - 7} ${EYE_Y + 2}Q${x} ${EYE_Y - 7} ${x + 7} ${EYE_Y + 2}`} />
        ))}
      </g>
    )
  }

  // Verschlafen: entspannt geschlossene Augen (︶︶)
  if (mood === 'sleepy') {
    return (
      <g fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round">
        {EYES_X.map((x) => (
          <path key={x} d={`M${x - 7} ${EYE_Y + 1}Q${x} ${EYE_Y + 6.5} ${x + 7} ${EYE_Y + 1}`} />
        ))}
      </g>
    )
  }

  const lid = mood === 'tired' ? 0.42 : mood === 'focus' ? 0.16 : 0
  const big = mood === 'hungry' || mood === 'cheer'
  const pr = big ? 6.4 : 5.6
  const dy = mood === 'sad' ? 3 : mood === 'hungry' ? -1.5 : 1.2
  const rx = 9
  const ry = 10.5

  return (
    <g className={lid < 0.4 ? 'bd-blink' : undefined} style={{ animationDelay: blinkDelay }}>
      {EYES_X.map((x, i) => {
        const dx = (i === 0 ? 1 : -1) * 0.9 + (mood === 'hungry' ? 1.5 : 0)
        const px = x + dx
        const py = EYE_Y + dy
        const lidY = robot ? EYE_Y - 9 + 18 * lid : EYE_Y - ry + 2 * ry * lid
        const lidW = robot ? 8.5 : rx * Math.sqrt(Math.max(0, 1 - Math.pow(2 * lid - 1, 2)))
        return (
          <g key={x}>
            {robot ? (
              <rect x={x - 9} y={EYE_Y - 9} width={18} height={18} rx={5} fill="#fff" stroke="rgba(0,0,0,.12)" strokeWidth={0.8} />
            ) : (
              <ellipse cx={x} cy={EYE_Y} rx={rx} ry={ry} fill="#fff" stroke="rgba(0,0,0,.12)" strokeWidth={0.8} />
            )}
            {robot ? (
              <rect x={px - pr * 0.85} y={py - pr * 0.85} width={pr * 1.7} height={pr * 1.7} rx={2.4} fill={INK} />
            ) : (
              <circle cx={px} cy={py} r={pr} fill={INK} />
            )}
            <circle cx={px - 1.8} cy={py - 2} r={big ? 2.3 : 1.9} fill="#fff" />
            <circle cx={px + 2.2} cy={py + 2.4} r={0.9} fill="#fff" opacity={0.85} />
            {lid > 0 &&
              (robot ? (
                <rect x={x - 9.5} y={EYE_Y - 9.5} width={19} height={lidY - (EYE_Y - 9.5)} rx={2} style={f(bodyFill)} />
              ) : (
                <path d={lidPath(x, EYE_Y, rx + 0.6, ry + 0.6, lid)} style={f(bodyFill)} />
              ))}
            {lid > 0 && (
              <line
                x1={x - lidW}
                x2={x + lidW}
                y1={lidY}
                y2={lidY}
                stroke={INK}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            )}
          </g>
        )
      })}
    </g>
  )
}

function Brows({ mood }: { mood: BuddyMood }) {
  const d =
    mood === 'sad'
      ? ['M39 46.5Q46 44.5 53 42']
      : mood === 'focus'
        ? ['M39.5 42.5Q47 43 53.5 46']
        : mood === 'tired'
          ? ['M39 44.5Q46 43 53 44.5']
          : null
  if (!d) return null
  return (
    <g fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round">
      <path d={d[0]} />
      <path d={d[0]} transform={MIRROR} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Mund
// ---------------------------------------------------------------------------

function Mouth({ mood }: { mood: BuddyMood }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (mood) {
    case 'proud':
      return (
        <g>
          <path d="M50 69Q60 70 70 69Q69 81 60 81Q51 81 50 69Z" fill={INK} />
          <path d="M54 78.4Q60 74.6 66 78.4Q63.5 81 60 81Q56.5 81 54 78.4Z" fill={PINK} />
        </g>
      )
    case 'cheer':
      return (
        <g>
          <path d="M48.5 68.5Q60 70.5 71.5 68.5Q70.5 83.5 60 83.5Q49.5 83.5 48.5 68.5Z" fill={INK} />
          <path d="M53 79.6Q60 74.6 67 79.6Q64 83.5 60 83.5Q56 83.5 53 79.6Z" fill={PINK} />
        </g>
      )
    case 'sleepy':
      return <ellipse cx={60} cy={73} rx={2.8} ry={2.3} fill={INK} />
    case 'sad':
      return <path d="M53 75.5Q60 69.5 67 75.5" {...line} />
    case 'hungry':
      return (
        <g>
          <path d="M52 69Q60 70 68 69Q66 77 60 77Q54 77 52 69Z" fill={INK} />
          <path d="M56 74.5Q56 82.5 60.5 82.5Q65 82.5 65 74.5Z" fill={PINK} />
          <path d="M60.5 76V80" stroke="#E46C84" strokeWidth={1} strokeLinecap="round" />
          <g className="bd-drop">
            <path d="M51.2 73Q49 78 51.2 79.2Q53.4 78 51.2 73Z" fill={WATER} />
          </g>
        </g>
      )
    case 'tired':
      return <path d="M50 73Q52.5 70 55 73T60 73T65 73T70 73" {...line} strokeWidth={2.6} />
    case 'focus':
      return <path d="M53 72.5Q60 75.5 67 72.5" {...line} />
    default:
      return <path d="M52 70.5Q60 78.5 68 70.5" {...line} />
  }
}

// ---------------------------------------------------------------------------
// Arme
// ---------------------------------------------------------------------------

function Arm({ up, muscle, band, mirror }: { up: boolean; muscle: boolean; band: boolean; mirror: boolean }) {
  const place = up ? 'translate(30 62) rotate(150)' : 'translate(27 74) rotate(28)'
  return (
    <g transform={mirror ? `${MIRROR} ${place}` : place}>
      <rect x={-6} y={-6} width={12} height={26} rx={6} style={f(BASE)} />
      {muscle && <circle cx={-4.6} cy={6} r={6.2} style={f(BASE)} />}
      <circle cx={0} cy={21} r={6.6} style={f(BASE)} />
      {muscle && <path d="M-7.5 3.5Q-5 0.5 -2 2" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round" />}
      {band && <rect x={-7.2} y={12.5} width={14.4} height={5} rx={2.2} fill="#fff" fillOpacity={0.94} />}
      {band && <rect x={-7.2} y={14.4} width={14.4} height={1.3} style={f(DARK)} />}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Ei (Stufe 0)
// ---------------------------------------------------------------------------

function Egg({ mood, shell, blinkDelay }: { mood: BuddyMood; shell: string; blinkDelay: string }) {
  const closed = mood === 'proud' || mood === 'sleepy'
  return (
    <g>
      <path d={EGG} style={f(shell)} stroke="rgba(0,0,0,.06)" strokeWidth={1} />
      <circle cx={42} cy={88} r={4.5} style={f(LIGHT)} opacity={0.55} />
      <circle cx={77} cy={92} r={3.2} style={f(LIGHT)} opacity={0.55} />
      <circle cx={72} cy={38} r={3.6} style={f(LIGHT)} opacity={0.55} />
      <circle cx={47} cy={34} r={2.2} style={f(LIGHT)} opacity={0.55} />
      <ellipse cx={46} cy={40} rx={8} ry={5} transform="rotate(-30 46 40)" fill="#fff" opacity={0.6} />
      {/* Riss mit Blick nach draußen */}
      <path d="M35 57L43 50L50 57L57 49L64 57L71 49L78 56L85 51L86.5 63Q60 75 33.5 63Z" fill="#2B2233" />
      <path d="M35 57L30 52M85 51L90.5 47" stroke="#C9B79C" strokeWidth={1.6} strokeLinecap="round" />
      {closed ? (
        <g fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
          {mood === 'proud' ? (
            <>
              <path d="M45 63Q50 57.5 55 63" />
              <path d="M65 63Q70 57.5 75 63" />
            </>
          ) : (
            <>
              <path d="M45 61.5Q50 64.5 55 61.5" />
              <path d="M65 61.5Q70 64.5 75 61.5" />
            </>
          )}
        </g>
      ) : (
        <g className="bd-blink" style={{ animationDelay: blinkDelay }}>
          {[50, 70].map((x) => (
            <g key={x}>
              <circle cx={x} cy={62} r={4.8} fill="#fff" />
              <circle cx={x + (x < 60 ? 0.8 : -0.8)} cy={mood === 'sad' ? 63.6 : 62.6} r={2.8} fill={INK} />
              <circle cx={x - 0.6} cy={61.2} r={1} fill="#fff" />
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Figur
// ---------------------------------------------------------------------------

export function Buddy({
  size = 64,
  mood = 'happy',
  stage = 1,
  skin = 'classic',
  className = '',
  animate = true,
  title,
}: BuddyProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduced = useReducedMotion()
  const [blinkDelay] = useState(() => `${(Math.random() * 4).toFixed(2)}s`)
  const st = Math.max(0, Math.min(5, Math.round(stage)))
  const s = SCALE[st]
  const anim = animate && !reduced

  const gBody = `bd${uid}b`
  const gShell = `bd${uid}s`
  const clip = `bd${uid}c`
  const bodyFill = `url(#${gBody})`

  const isRobot = skin === 'robot'
  const isCat = skin === 'cat'
  const isBeast = skin === 'beast'
  const isClassic = !isRobot && !isCat && !isBeast

  const showArms = st >= 2 || (mood === 'cheer' && st >= 1)
  const armsUp = mood === 'cheer'
  const headband = st >= 3 || mood === 'focus'

  // Hinter dem Körper: Arme, Ohren, Hörner, Antenne, Federschopf
  const back: ReactNode[] = []
  if (st > 0) {
    if (showArms) {
      back.push(
        <g key="arms">
          <Arm up={armsUp} muscle={st >= 4} band={st >= 4} mirror={false} />
          <Arm up={armsUp} muscle={st >= 4} band={st >= 4} mirror />
        </g>,
      )
    }
    if (isCat) {
      back.push(
        <g key="ears" strokeLinejoin="round">
          {[undefined, MIRROR].map((t, i) => (
            <g key={i} transform={t}>
              <path d="M33 44L30 13L55 28Z" style={{ fill: BASE, stroke: BASE }} strokeWidth={4} />
              <path d="M37 33L34.5 19L47 27Z" fill={PINK} opacity={0.75} />
            </g>
          ))}
        </g>,
      )
    }
    if (isBeast) {
      back.push(
        <g key="horns">
          {[undefined, MIRROR].map((t, i) => (
            <path key={i} transform={t} d="M40 35Q33 24 33 12Q42 20 50 28Z" fill="#F4E3C3" stroke="#D9C29A" strokeWidth={1} strokeLinejoin="round" />
          ))}
          <path d="M50 28L54 17L58 26ZM56 26L60 13L64 26ZM62 26L66 17L70 28Z" style={f(DARK)} strokeLinejoin="round" />
        </g>,
      )
    }
    if (isRobot) {
      back.push(
        <g key="antenna">
          <path d="M70 28L77 11" stroke="#9AA3B2" strokeWidth={2.6} strokeLinecap="round" />
          <circle cx={77.5} cy={9.5} r={4.2} fill={GOLD} stroke="#D97706" strokeWidth={1} />
          <rect x={14.5} y={53} width={10} height={17} rx={3.5} fill="#AEB6C4" />
          <rect x={95.5} y={53} width={10} height={17} rx={3.5} fill="#AEB6C4" />
        </g>,
      )
    }
    if (isClassic && st < 5) {
      back.push(
        <g key="tuft" style={f(BASE)}>
          <path d="M60 28C54 21 55 13 61 10C59 16 61 21 65 26Z" />
          <path d="M62 28C64 20 69 16 74 17C70 20 68 24 67 29Z" />
        </g>,
      )
    }
  }

  const body =
    st === 0 ? (
      <Egg mood={mood} shell={`url(#${gShell})`} blinkDelay={blinkDelay} />
    ) : (
      <g>
        {back}
        <path d={BODY} style={f(bodyFill)} />
        {/* Bauch / Panel */}
        {isRobot ? (
          <g>
            <rect x={42} y={79} width={36} height={18} rx={5} fill="#fff" fillOpacity={0.22} style={{ stroke: DARK }} strokeWidth={1.2} />
            <circle cx={49.5} cy={88} r={2.3} fill="#34D399" />
            <circle cx={56.5} cy={88} r={2.3} fill={GOLD} />
            <path d="M63 85.5H72M63 90.5H69" style={{ stroke: DARK }} strokeWidth={1.6} strokeLinecap="round" />
            <circle cx={30} cy={44} r={2} fill="#fff" fillOpacity={0.45} />
            <circle cx={90} cy={44} r={2} fill="#fff" fillOpacity={0.45} />
          </g>
        ) : (
          <g>
            <ellipse cx={60} cy={87} rx={25} ry={17} style={f(LIGHT)} opacity={0.6} />
            <ellipse cx={60} cy={87} rx={25} ry={17} fill="#fff" opacity={0.2} />
            {isBeast && (
              <path
                d="M40 80Q60 84 80 80M38 87Q60 91 82 87M42 94Q60 98 78 94"
                fill="none"
                style={{ stroke: DARK }}
                strokeOpacity={0.45}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            )}
          </g>
        )}
        {/* Glanzlicht */}
        <ellipse cx={44} cy={40} rx={11} ry={6.5} transform="rotate(-32 44 40)" fill="#fff" opacity={0.32} />
        <circle cx={57} cy={31} r={2.2} fill="#fff" opacity={0.32} />
        {/* Stirnband */}
        {headband && (
          <g>
            <g clipPath={`url(#${clip})`}>
              <rect x={10} y={34} width={100} height={8} style={f(DARK)} />
              <path d="M10 38H110" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.4} />
            </g>
            <path d="M93 37Q101 31 106 33Q101 37 94 40ZM93 40Q100 43 103 49Q97 47 92 42Z" style={f(DARK)} />
          </g>
        )}
        <Brows mood={mood} />
        <Eyes mood={mood} robot={isRobot} bodyFill={bodyFill} blinkDelay={blinkDelay} />
        {/* Bäckchen */}
        <ellipse cx={35} cy={69} rx={6} ry={3.6} fill={PINK} opacity={mood === 'sad' || mood === 'tired' ? 0.3 : 0.55} />
        <ellipse cx={85} cy={69} rx={6} ry={3.6} fill={PINK} opacity={mood === 'sad' || mood === 'tired' ? 0.3 : 0.55} />
        {isCat && <path d="M57.4 65.2H62.6L60 68.2Z" fill={PINK} stroke={PINK} strokeWidth={1} strokeLinejoin="round" />}
        <Mouth mood={mood} />
        {isCat && (
          <g stroke={INK} strokeOpacity={0.45} strokeWidth={1.3} strokeLinecap="round">
            <path d="M31 70L19 67.5M31 73.5L19 75" />
            <path d="M31 70L19 67.5M31 73.5L19 75" transform={MIRROR} />
          </g>
        )}
        {/* Schweißtropfen */}
        {mood === 'tired' && (
          <path d="M89 44Q84.5 51.5 89 54Q93.5 51.5 89 44Z" fill={WATER} stroke="#5FB3E6" strokeWidth={0.8} />
        )}
        {/* Eierschale (frisch geschlüpft) */}
        {st === 1 && (
          <path
            d="M28 86L35 80L42 88L49 80L56 88L63 80L70 88L77 80L84 88L92 82C94 98 79 108 60 108C41 108 26 98 28 86Z"
            style={f(`url(#${gShell})`)}
            stroke="rgba(0,0,0,.07)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        )}
        {/* Krone (Champion) */}
        {st >= 5 && (
          <g>
            <path
              d="M50.5 29L48.5 15L55 21L60 11L65 21L71.5 15L69.5 29Z"
              fill={GOLD}
              stroke="#D97706"
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
            <circle cx={60} cy={24} r={2} fill="#fff" />
            <circle cx={60} cy={11} r={1.6} fill={GOLD} stroke="#D97706" strokeWidth={0.8} />
          </g>
        )}
      </g>
    )

  // Effekte um die Figur (skalieren mit, atmen aber nicht mit)
  const fx: ReactNode[] = []
  if (mood === 'proud' || mood === 'cheer') {
    fx.push(
      <g key="stars" fill={GOLD}>
        <path className="bd-twinkle" d={star(16, 38, 6)} />
        <path className="bd-twinkle bd-tw2" d={star(104, 32, 7)} />
        <path className="bd-twinkle bd-tw3" d={star(106, 74, 4.5)} />
        <path className="bd-twinkle bd-tw2" d={star(12, 70, 4)} />
      </g>,
    )
  }
  if (mood === 'sleepy') {
    fx.push(
      <g key="z" style={{ fill: 'rgb(var(--c-text-muted))' }} fontWeight={800} fontFamily="inherit">
        <text className="bd-z" x={88} y={36} fontSize={12}>
          z
        </text>
        <text className="bd-z bd-z2" x={97} y={22} fontSize={16}>
          Z
        </text>
      </g>,
    )
  }
  if (mood === 'hungry' && st > 0) {
    fx.push(
      <g key="bubble">
        <circle cx={86} cy={40} r={2.2} fill="#fff" stroke="rgba(0,0,0,.18)" strokeWidth={1.2} />
        <circle cx={92} cy={32} r={3.2} fill="#fff" stroke="rgba(0,0,0,.18)" strokeWidth={1.2} />
        <circle cx={103} cy={18} r={11.5} fill="#fff" stroke="rgba(0,0,0,.18)" strokeWidth={1.2} />
        <g fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M99 11V26M97 11V15.5Q97 18 99 18Q101 18 101 15.5V11" />
          <path d="M107 26V11Q110.5 14 110 19Q109.5 21 107 21" />
        </g>
      </g>,
    )
  }

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`${anim ? 'buddy-anim ' : ''}overflow-visible ${className}`}
      role="img"
      aria-label={title ?? 'Buddy'}
    >
      <style>{STYLE}</style>
      <defs>
        <radialGradient id={gBody} gradientUnits="userSpaceOnUse" cx={50} cy={44} r={72} fx={46} fy={38}>
          <stop offset="0" style={{ stopColor: LIGHT }} />
          <stop offset="0.55" style={{ stopColor: BASE }} />
          <stop offset="1" style={{ stopColor: DARK }} />
        </radialGradient>
        <radialGradient id={gShell} gradientUnits="userSpaceOnUse" cx={48} cy={40} r={78}>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#FBF3E6" />
          <stop offset="1" stopColor="#E8D6BB" />
        </radialGradient>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <ellipse cx={60} cy={108} rx={30 * s} ry={4.5 * s} fill="#000" opacity={0.14} />
      <g className={mood === 'cheer' ? 'bd-bounce' : undefined}>
        <g transform={`translate(60 107) scale(${s}) translate(-60 -107)`}>
          <g className={st === 0 ? 'bd-wiggle' : 'bd-breathe'}>{body}</g>
          {fx}
        </g>
      </g>
    </svg>
  )
}

/** Entwickler-Übersicht: alle Stimmungen × Stufen (wird nirgends eingebunden). */
export function BuddyGallery({ skin = 'classic' }: { skin?: string }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {BUDDY_MOODS.flatMap((m) =>
        [0, 1, 2, 3, 4, 5].map((st) => (
          <div key={`${m}${st}`} className="flex flex-col items-center text-[10px] text-cocoa-muted">
            <Buddy size={56} mood={m} stage={st} skin={skin} />
            {m} · {st}
          </div>
        )),
      )}
    </div>
  )
}
