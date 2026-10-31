import { describe, expect, it } from 'vitest'
import { isShareCancel, shareOutcomeText } from './shareFile'

describe('shareFile', () => {
  it('erkennt Abbruch im Teilen-Menü', () => {
    expect(isShareCancel(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true)
    expect(isShareCancel(new Error('Share canceled'))).toBe(true)
    expect(isShareCancel(new Error('Permission denied'))).toBe(false)
  })

  it('Hinweis passt zum echten Ergebnis', () => {
    expect(shareOutcomeText('shared')).toBeNull()
    expect(shareOutcomeText('cancelled')).toBeNull()
    expect(shareOutcomeText('downloaded')).toMatch(/gespeichert/)
    expect(shareOutcomeText('failed')).toMatch(/nicht/)
  })
})
