import { describe, expect, it } from 'vitest'
import { applyHealth, newGame, evolutionProgress } from './game'
describe('sincronização de atividade', () => {
  it('não credita novamente a mesma leitura ou uma correção menor', () => {
    const first = applyHealth(newGame(), '2026-01-01', 1000, 50)
    const second = applyHealth(first, '2026-01-01', 1000, 50)
    const corrected = applyHealth(second, '2026-01-01', 800, 40)
    const increased = applyHealth(corrected, '2026-01-01', 1100, 55)
    expect(first.vital).toBe(150); expect(second.vital).toBe(150); expect(increased.vital).toBe(165); expect(increased.distance).toBe(1100)
  })
  it('reinicia a contagem diária e mantém dados ausentes separados de zero', () => {
    const first = applyHealth(newGame(), '2026-01-01', 100, 0)
    const next = applyHealth(first, '2026-01-02', 200, null)
    expect(first.calories).toBe(0)
    expect(next).toMatchObject({ distance: 300, vital: 30, calories: null })
  })
  it('ignora a leitura de um dia anterior ao último dia sincronizado', () => {
    const first = applyHealth(newGame(), '2026-01-01', 100, 10)
    const next = applyHealth(first, '2026-01-02', 200, 20)
    expect(applyHealth(next, '2026-01-01', 200, 20)).toBe(next)
  })
  it('conserva os créditos de dados temporariamente inválidos ou ausentes', () => {
    const first = applyHealth(newGame(), '2026-01-01', 99, 10.5)
    const unavailable = applyHealth(first, '2026-01-01', Number.NaN, -1)
    expect(unavailable).toMatchObject({ steps: null, calories: null, vital: 19, distance: 99 })
    const next = applyHealth(unavailable, '2026-01-01', 100, 11.2)
    expect(next).toMatchObject({ vital: 21, distance: 100 })
  })
})

describe('requisitos de evolução', () => {
  const requirements = { minutes: 10, vital: 100, trophies: 2, battles: 3, winRatio: 60, adventureLevel: 65535 }
  it('libera a evolução apenas quando todos os requisitos são cumpridos', () => {
    const game = { ...newGame(), born: 0, vital: 100, power: 1, stamina: 1, battles: 3, wins: 2 }
    expect(evolutionProgress(game, requirements, 599999).ready).toBe(false)
    expect(evolutionProgress(game, requirements, 600000).ready).toBe(true)
    expect(evolutionProgress({ ...game, wins: 1 }, requirements, 600000).ready).toBe(false)
  })
  it('exige que a área solicitada tenha sido concluída', () => {
    const game = { ...newGame(), born: 0, vital: 100, power: 2, battles: 3, wins: 3 }
    const areaRequirements = { ...requirements, adventureLevel: 1 }
    expect(evolutionProgress(game, areaRequirements, 600000)).toMatchObject({ areaUnavailable: true, ready: false })
    expect(evolutionProgress({ ...game, adventureLevel: 0 }, areaRequirements, 600000).ready).toBe(false)
    expect(evolutionProgress({ ...game, adventureLevel: 1 }, areaRequirements, 600000)).toMatchObject({ areaUnavailable: false, ready: true })
  })
})
