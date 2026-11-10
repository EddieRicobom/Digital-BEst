/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getBemStats } from './bem-stats'
import { dimStatsForArena, getDimStats } from './dim-stats'
import { activePartner, evolutionProgress, newGame } from './game'
import templates from './templates.json'

const impulseCity = 'd70ac942423445cb'
const dimTemplates = templates.filter(template => template.type === 'DIM')

describe('catálogo DIM', () => {
  it('preserva BEM e inclui linhas DIM distintas com ovo e transições válidas', () => {
    expect(templates.filter(template => template.type === 'BEM')).toHaveLength(15)
    expect(dimTemplates).toHaveLength(35)
    expect(new Set(dimTemplates.map(template => template.name)).size).toBe(dimTemplates.length)
    expect(dimTemplates.some(template => template.name === 'Medarot')).toBe(false)
    expect(dimTemplates.flatMap(template => template.evolutions)).toHaveLength(866)
    for (const { characters, evolutions } of dimTemplates) {
      const indexes = new Set(characters.map(character => character.index))
      expect(characters.some(c => c.stage === 0 && evolutions.some(e => e.from === c.index && e.adventureLevel === 65535))).toBe(true)
      expect(evolutions.every(e => indexes.has(e.from) && indexes.has(e.to) && e.minutes > 0 && e.minutes % 60 === 0)).toBe(true)
    }
  })

  it('converte horas e exige a última etapa de aventura de uma forma bloqueada', () => {
    const impulse = dimTemplates.find(template => template.id === impulseCity)!
    const bulkmon = impulse.evolutions.find(e => e.from === 2 && e.to === 3)!
    const shroudmon = impulse.evolutions.find(e => e.from === 7 && e.to === 16)!
    expect(bulkmon).toMatchObject({ minutes: 960, adventureLevel: 65535 })
    expect(shroudmon).toMatchObject({ minutes: 1440, adventureLevel: 14 })

    const game = newGame()
    const partner = activePartner(game)
    game.vital = shroudmon.vital
    partner.power = shroudmon.trophies
    partner.wins = partner.battles = shroudmon.battles
    partner.adventureLevel = 13
    const when = partner.born + shroudmon.minutes * 60000
    expect(evolutionProgress(game, shroudmon, when).ready).toBe(false)
    partner.adventureLevel = 14
    expect(evolutionProgress(game, shroudmon, when).ready).toBe(true)
  })

  it('inclui tiras locais compatíveis para todos os ovos e personagens DIM', () => {
    for (const { id, characters } of dimTemplates) {
      const directory = new URL(`../public/assets/sprites/${id}/`, import.meta.url)
      const egg = readFileSync(new URL('egg.png', directory))
      expect([egg.readUInt32BE(16), egg.readUInt32BE(20)]).toEqual([32 * 8, 40])
      for (const { index } of characters) {
        const strip = readFileSync(new URL(`${index}.png`, directory))
        expect([strip.readUInt32BE(16), strip.readUInt32BE(20)]).toEqual([64 * 12, 56])
      }
    }
  })

  it('preserva a escala DIM e converte AP e HP separadamente para a arena', () => {
    expect(getDimStats(impulseCity, 2)).toEqual({ ap: 2, hp: 3, bp: 10 })
    expect(getBemStats(impulseCity, 2)).toBeNull()
    expect(dimStatsForArena(impulseCity, 2)).toEqual({ ap: 900, hp: 2500 })
    expect(dimStatsForArena('ffffde3475e68d8e', 16)?.ap).toBe(2200)
    expect(dimStatsForArena('9f05503d4519d2bf', 16)?.hp).toBe(6500)
    expect(getDimStats('25bf1590b59892d9', 2)).toBeNull()
    expect(dimStatsForArena(impulseCity, 0)).toBeNull()
    expect(dimStatsForArena(impulseCity, null)).toBeNull()
  })
})
