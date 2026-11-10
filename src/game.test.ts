import { describe, expect, it } from 'vitest'
import { activePartner, applyHealth, evolutionProgress, migrateGame, newGame, recordForm, switchPartner } from './game'

describe('equipe de parceiros', () => {
  it('migra o parceiro e os créditos de saúde do save anterior', () => {
    const partner = {
      partner: 'Agumon', templateId: 'agumon', characterIndex: 3, egg: false, born: 12345,
      power: 8, stamina: 4, battles: 6, wins: 3, adventureLevel: 2,
      history: ['Botamon digievoluiu para Agumon!'],
    }
    const activity = {
      vital: 380, distance: 4600, lastDay: '2026-01-01', creditedSteps: 3200, creditedCalories: 0,
      steps: 3100, calories: 0, updated: '2026-01-01T10:00:00Z',
    }
    const game = migrateGame({ ...partner, ...activity })
    expect(game).toMatchObject({ ...activity, version: 2, activePartnerIndex: 0 })
    expect(game.partners).toHaveLength(4)
    expect(activePartner(game)).toMatchObject(partner)
    expect(game.partners.slice(1)).toEqual(Array.from({ length: 3 }, () => expect.objectContaining({ partner: '', egg: false })))
    expect(applyHealth(game, activity.lastDay, 3200, 0)).toMatchObject({ vital: 380, distance: 4600 })
  })

  it('migra um ovo pendente e persiste a equipe e o parceiro ativo', () => {
    const game = migrateGame({ templateId: 'agumon', characterIndex: 0, egg: true })
    expect(activePartner(game)).toMatchObject({ partner: '', templateId: 'agumon', characterIndex: 0, egg: true })
    const lastSlot = switchPartner(game, 3)
    Object.assign(activePartner(lastSlot), { partner: 'Gabumon', templateId: 'gabumon', characterIndex: 4, born: 2000, battles: 2 })
    recordForm(activePartner(lastSlot), 'Gabumon', 'gabumon', 2000)
    const reloaded = migrateGame(JSON.parse(JSON.stringify(lastSlot)))
    expect(reloaded).toEqual(lastSlot)
    expect(activePartner(reloaded).partner).toBe('Gabumon')
    expect(activePartner(switchPartner(reloaded, 0)).egg).toBe(true)
    expect(switchPartner(reloaded, 4)).toBe(reloaded)
    expect(switchPartner(reloaded, 0.5)).toBe(reloaded)
  })

  it('troca os dados de treino e evolução, mantendo os VP e a atividade compartilhados', () => {
    const first = applyHealth(newGame(), '2026-01-01', 1000, 50)
    Object.assign(activePartner(first), { partner: 'Agumon', power: 3, stamina: 2, battles: 5, wins: 4, adventureLevel: 0 })
    activePartner(first).history.push('Treino de força concluído.')
    const second = switchPartner(first, 1)
    expect(activePartner(second)).toMatchObject({ power: 0, stamina: 0, battles: 0, wins: 0, adventureLevel: -1, history: [] })
    Object.assign(activePartner(second), { partner: 'Gabumon', power: 1 })
    second.vital -= 25
    const synced = applyHealth(second, '2026-01-01', 1100, 50)
    const returned = switchPartner(synced, 0)
    expect(returned).toMatchObject({ vital: 135, distance: 1100, steps: 1100, calories: 50 })
    expect(activePartner(returned)).toMatchObject({ partner: 'Agumon', power: 3, stamina: 2, battles: 5, wins: 4, history: ['Treino de força concluído.'] })
    expect(activePartner(switchPartner(returned, 1))).toMatchObject({ partner: 'Gabumon', power: 1, history: [] })
  })
})

describe('histórico de formas', () => {
  it('recupera a ordem e a linha BEM de um diário v1', () => {
    const game = migrateGame({
      partner: 'Metal Greymon (Virus)', templateId: 'aniversario', born: 12345,
      history: [
        'Vitória na arena digital.',
        'Greymon digievoluiu para Metal Greymon (Virus)!',
        'Koromon digievoluiu para Greymon!',
        'Treino de força concluído.',
        'Koromon nasceu do ovo misterioso.',
      ],
    })
    expect(activePartner(game).forms).toEqual([
      { name: 'Koromon', templateId: 'aniversario', timestamp: null },
      { name: 'Greymon', templateId: 'aniversario', timestamp: null },
      { name: 'Metal Greymon (Virus)', templateId: 'aniversario', timestamp: 12345 },
    ])
  })

  it('recupera a origem da primeira evolução e inclui a forma atual ausente do diário v2', () => {
    const game = migrateGame({
      version: 2, activePartnerIndex: 1,
      partners: [null, { partner: 'WereGarurumon', templateId: 'linha-atual', born: 12345, history: ['Gabumon digievoluiu para Garurumon!'] }],
    })
    expect(activePartner(game).forms).toEqual([
      { name: 'Gabumon', templateId: null, timestamp: null },
      { name: 'Garurumon', templateId: null, timestamp: null },
      { name: 'WereGarurumon', templateId: 'linha-atual', timestamp: 12345 },
    ])
  })

  it('persiste formas registradas, com os metadados do slot em cada evolução', () => {
    const game = newGame()
    const partner = activePartner(game)
    recordForm(partner, 'Botamon', 'aniversario', 1000)
    recordForm(partner, 'Koromon', 'aniversario', 2000)
    recordForm(partner, 'Agumon', 'draconic', 3000)
    recordForm(partner, 'Agumon', 'draconic', 3000)
    Object.assign(partner, { partner: 'Agumon', templateId: 'draconic', born: 3000 })

    const reloaded = migrateGame(JSON.parse(JSON.stringify(game)))
    expect(activePartner(reloaded).forms).toEqual([
      { name: 'Botamon', templateId: 'aniversario', timestamp: 1000 },
      { name: 'Koromon', templateId: 'aniversario', timestamp: 2000 },
      { name: 'Agumon', templateId: 'draconic', timestamp: 3000 },
    ])
    expect(activePartner(switchPartner(reloaded, 1)).forms).toEqual([])
  })

  it('mantém vazio o histórico de formas do ovo', () => {
    const egg = activePartner(migrateGame({
      egg: true, partner: 'Botamon', history: ['Botamon nasceu do ovo misterioso.'],
      forms: [{ name: 'Botamon', templateId: 'aniversario', timestamp: 1000 }],
    }))
    recordForm(egg, 'Botamon', 'aniversario', 1000)
    expect(egg.forms).toEqual([])
  })
})

describe('sincronização de atividade', () => {
  it('guarda distância física e exercícios sem alterar os passos de aventura', () => {
    const first = applyHealth(newGame(), '2026-01-01', 100, 5, 750, 20)
    expect(first).toMatchObject({ distance: 100, healthDistanceMeters: 750, exerciseMinutes: 20, vital: 15 })
    const restored = migrateGame(first)
    expect(restored).toMatchObject({ distance: 100, healthDistanceMeters: 750, exerciseMinutes: 20 })
    const next = applyHealth(restored, '2026-01-02', 200, 0, null, null)
    expect(next).toMatchObject({ distance: 300, healthDistanceMeters: null, exerciseMinutes: null })
  })
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
    const game = migrateGame({ born: 0, vital: 100, power: 1, stamina: 1, battles: 3, wins: 2 })
    expect(evolutionProgress(game, requirements, 599999).ready).toBe(false)
    expect(evolutionProgress(game, requirements, 600000).ready).toBe(true)
    expect(evolutionProgress(switchPartner(game, 1), requirements, 600000).ready).toBe(false)
    activePartner(game).wins = 1
    expect(evolutionProgress(game, requirements, 600000).ready).toBe(false)
  })
  it('exige que a área solicitada tenha sido concluída', () => {
    const game = migrateGame({ born: 0, vital: 100, power: 2, battles: 3, wins: 3 })
    const areaRequirements = { ...requirements, adventureLevel: 1 }
    expect(evolutionProgress(game, areaRequirements, 600000)).toMatchObject({ areaUnavailable: true, ready: false })
    activePartner(game).adventureLevel = 0
    expect(evolutionProgress(game, areaRequirements, 600000).ready).toBe(false)
    activePartner(game).adventureLevel = 1
    expect(evolutionProgress(game, areaRequirements, 600000)).toMatchObject({ areaUnavailable: false, ready: true })
  })
})
