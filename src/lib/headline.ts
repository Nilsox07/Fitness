// Buddy-Spruch als Überschrift: erster Satz (kurz), der Rest erst auf Tippen.
// Reine Logik – getestet in headline.test.ts.

/** Abkürzungen, nach deren Punkt kein Satz endet */
const ABBR = /^(z|d|u|o|bzw|ca|evtl|inkl|max|min|ggf|usw|vgl|nr|bspw|std|mind)$/i

/** Ende des ersten Satzes (Index nach dem Satzzeichen) oder -1 */
function firstSentenceEnd(t: string): number {
  const re = /[.!?](?=\s|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const before = t.slice(0, m.index).split(/\s+/).pop() ?? ''
    const after = t.slice(m.index + 1).trimStart()
    if (m[0] === '.' && (ABBR.test(before) || before.length === 1)) continue
    if (after && /^[a-zäöüß]/.test(after)) continue
    return m.index + 1
  }
  return -1
}

/** Teilt einen Text in Überschrift (erster Satz, max. `max` Zeichen ≈ 2 Zeilen) und Rest. */
export function splitHeadline(text: string, max = 60): { head: string; rest: string } {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return { head: '', rest: '' }
  const end = firstSentenceEnd(t)
  let head = end > 0 ? t.slice(0, end) : t
  let rest = t.slice(head.length).trim()
  if (head.length > max) {
    // lieber am Gedankenstrich teilen …
    const dash = head.indexOf(' – ')
    if (dash >= 8 && dash <= max) {
      rest = (head.slice(dash + 3) + ' ' + rest).trim()
      head = head.slice(0, dash)
    } else {
      // … sonst an einer Wortgrenze kürzen
      const cut = head.lastIndexOf(' ', max - 1)
      const keep = cut > 30 ? cut : max - 1
      rest = (head.slice(keep).trim() + ' ' + rest).trim()
      head = head.slice(0, keep).replace(/[,;:–-]+$/, '') + ' …'
    }
  }
  return { head, rest }
}
