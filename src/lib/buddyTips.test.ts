import { describe, expect, it } from 'vitest'
import { pageTip, type TipContext } from './buddyTips'

const base: TipContext = {
  hour: 12,
  kcalEaten: 1200,
  kcalTarget: 2200,
  proteinEaten: 80,
  proteinTarget: 150,
  waterMl: 1500,
  waterTarget: 2500,
  trainedToday: false,
  restDay: false,
  nextWorkout: 'Push',
  weekDone: 1,
  weekGoal: 3,
  streakWeeks: 2,
  readiness: null,
  sleepMin: null,
  restingHr: null,
  restingHrNormal: null,
  friends: 2,
  showNutrition: true,
  hasWatch: false,
  hardShare: null,
}

describe('Buddy-Tipps', () => {
  it('niedrige Tagesform hat Vorrang und bietet eine KI-Frage', () => {
    const t = pageTip('today', { ...base, readiness: 40 })!
    expect(t.key).toBe('today-low')
    expect(t.ask).toMatch(/40\/100/)
  })

  it('abends fehlendes Eiweiß → Essensvorschlag', () => {
    const t = pageTip('nutrition', { ...base, hour: 19, proteinEaten: 60 })!
    expect(t.key).toBe('food-protein')
    expect(t.text).toMatch(/90 g Eiweiß/)
  })

  it('ohne Ernährungsmodul kein Ernährungstipp', () => {
    expect(pageTip('nutrition', { ...base, showNutrition: false })).toBeNull()
  })

  it('Training erledigt → Lob', () => {
    expect(pageTip('training', { ...base, trainedToday: true })!.mood).toBe('proud')
  })

  it('ohne Buddy Plus: leerer Tag führt zur Suche statt zum Foto', () => {
    const plus = pageTip('nutrition', { ...base, hour: 12, kcalEaten: 0 })!
    expect(plus.action?.to).toBe('/nutrition?add=photo')
    const free = pageTip('nutrition', { ...base, hour: 12, kcalEaten: 0, aiPlus: false })!
    expect(free.key).toBe('food-empty')
    expect(free.action?.to).toBe('/nutrition?add=search')
  })

  it('Ruhepuls deutlich erhöht → Hinweis', () => {
    expect(pageTip('vitals', { ...base, restingHr: 60, restingHrNormal: 54 })!.key).toBe('vitals-rhr')
  })
})
