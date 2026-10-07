import { describe, expect, it } from 'vitest'
import { extractUrl, recipeFromPost } from './ai'

describe('extractUrl', () => {
  it('holt den Link aus geteiltem Text', () => {
    expect(extractUrl('Schau dir das an! https://vm.tiktok.com/ZMabc123/ #rezept')).toBe('https://vm.tiktok.com/ZMabc123/')
    expect(extractUrl('https://www.instagram.com/reel/Cx1/?igsh=abc.')).toBe('https://www.instagram.com/reel/Cx1/?igsh=abc')
    expect(extractUrl('nur Text ohne Link')).toBeNull()
  })
})

describe('recipeFromPost', () => {
  it('erfindet nichts, wenn der Beitrag leer ist', async () => {
    const empty = { source: 'Instagram', url: 'https://instagram.com/p/x', title: 'Instagram', caption: '', author: '', image: null, recipe: null }
    await expect(recipeFromPost(empty)).rejects.toThrow('Screenshot')
  })
})
