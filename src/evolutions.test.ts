import { describe, expect, it } from 'vitest'
import templates from './templates.json'
import { mixedEvolutions } from './evolutions'

describe('linhas de evolução interligadas', () => {
  it('une caminhos de uma mesma forma e mantém os requisitos de cada template', () => {
    const primary = templates.find(t => t.name === 'Imperialdramon')!
    const secondary = templates.find(t => t.name === 'D-3 White and Yellow')!
    const paths = mixedEvolutions('v-mon', 2, primary.id)
    expect(paths.some(e => e.sourceId === primary.id)).toBe(true)
    expect(paths.some(e => e.sourceId === secondary.id && e.crossed)).toBe(true)
    for (const edge of paths) {
      const template = templates.find(t => t.id === edge.sourceId)!
      expect(template.evolutions).toContainEqual(expect.objectContaining({ from: edge.from, to: edge.to, minutes: edge.minutes, vital: edge.vital, trophies: edge.trophies, battles: edge.battles, winRatio: edge.winRatio, adventureLevel: edge.adventureLevel }))
    }
  })
  it('não mistura estágios diferentes e não adiciona 25th Anniversary a outras linhas', () => {
    const pulse = templates.find(t => t.name === 'Pulsemon')!
    expect(mixedEvolutions('Pulsemon', 0, pulse.id)).toEqual([])
    expect(mixedEvolutions('Pulsemon', 2, pulse.id).every(e => e.sourceName !== '25th Anniversary')).toBe(true)
  })
  it('mantém a linha 25th para quem já possui esse template', () => {
    const original = templates.find(t => t.name === '25th Anniversary')!
    expect(mixedEvolutions('Botamon', 0, original.id).some(e => e.sourceId === original.id)).toBe(true)
  })
})
