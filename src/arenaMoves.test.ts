import { describe, expect, it } from 'vitest'
import { arenaMoves, type ArenaMovePattern } from './arenaMoves'
import templates from './templates.json'

describe('golpes da arena', () => {
  it('diferencia as formas da mesma linha pelo golpe principal', () => {
    const gammamon = 'c8dacdf5b84f7f33'
    expect(arenaMoves('  Betel   Gammamon  ', undefined, gammamon)[0]).toMatchObject({
      name: 'Garra de Cometa',
      category: 'fire',
      pattern: 'slash',
    })
    expect(arenaMoves('Kaus Gammamon', 3, gammamon)[0]).toMatchObject({
      category: 'wind',
      pattern: 'spread',
    })
    expect(arenaMoves('Wezen Gammamon', 3, gammamon)[0]).toMatchObject({
      category: 'metal',
      pattern: 'pierce',
    })
  })

  it('preserva a identidade de uma espécie que aparece em mais de um template', () => {
    const anniversary = '843b04f90bb09dbd'
    const pulsemon = '25bf1590b59892d9'
    expect(arenaMoves('Pulsemon', 2, anniversary)).toEqual(arenaMoves('Pulsemon', 2, pulsemon))
    expect(arenaMoves('Pulsemon', 2, anniversary)[0].category).toBe('electric')
  })

  it('usa a linha para formas sem assinatura e tem um conjunto neutro para parceiros desconhecidos', () => {
    const jellymon = '2704968a7410c870'
    const levelThree = arenaMoves('Tobiumon', 3, jellymon)
    expect(levelThree[0]).toMatchObject({ category: 'water', pattern: 'spread' })
    expect(arenaMoves('Tobiumon', Number.NaN, 'template-desconhecido')).toEqual(levelThree)
    expect(arenaMoves('Parceiro legado', 6)[0]).toMatchObject({ category: 'physical', pattern: 'burst' })
    expect(arenaMoves('Parceiro legado', -1)).toEqual(arenaMoves('Parceiro legado', 2))
  })

  it('equipara os bebês por estágio e melhora as estatísticas conforme crescem', () => {
    const firstBaby = arenaMoves('Puyomon')
    const secondBaby = arenaMoves('Puyoyomon')
    const trained = arenaMoves('Jellymon')
    expect(firstBaby[0]).toMatchObject({ name: 'Bolha Digital', category: 'physical', pattern: 'shot' })
    expect(secondBaby[0].power).toBeGreaterThan(firstBaby[0].power)
    expect(trained[0].range).toBeGreaterThan(secondBaby[0].range)
    expect(trained[0].cooldownMs).toBeLessThan(secondBaby[0].cooldownMs)
  })

  it('oferece três opções válidas e taticamente diferentes para cada forma do catálogo', () => {
    const patterns = new Set<ArenaMovePattern>()
    for (const template of templates) {
      for (const partner of template.characters) {
        const moves = arenaMoves(partner.name, partner.stage, template.id)
        expect(new Set(moves.map(move => move.name)).size).toBe(3)
        expect(new Set(moves.map(move => move.pattern)).size).toBe(3)
        for (const move of moves) {
          expect(move.color).toMatch(/^#[0-9a-f]{6}$/)
          expect(move.power).toBeGreaterThan(0)
          expect(move.range).toBeGreaterThan(7)
          expect(move.range).toBeLessThan(50)
          expect(move.cooldownMs).toBeGreaterThan(450)
          expect(move.cooldownMs).toBeLessThan(1200)
          patterns.add(move.pattern)
        }
      }
    }
    expect(patterns).toEqual(new Set(['shot', 'spread', 'pierce', 'burst', 'slash']))
  })
})
