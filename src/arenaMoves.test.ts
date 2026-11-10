/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { arenaMoves, arenaMoveStyles, type ArenaMovePattern, type ArenaMoveVisual } from './arenaMoves'
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
    expect(firstBaby[0]).toMatchObject({ name: 'Bolha Digital', category: 'physical', pattern: 'shot', visual: 'bubble' })
    expect(arenaMoves('Botamon')).toEqual(firstBaby)
    expect(secondBaby[0].power).toBeGreaterThan(firstBaby[0].power)
    expect(trained[0].range).toBeGreaterThan(secondBaby[0].range)
    expect(trained[0].cooldownMs).toBeLessThan(secondBaby[0].cooldownMs)
  })

  it('equilibra força, alcance e recarga de estilos diferentes do mesmo padrão', () => {
    const fireball = arenaMoves('Agumon', 2)[0]
    const spark = arenaMoves('Jellymon', 2)[0]
    expect(fireball).toMatchObject({ pattern: 'shot', visual: 'fireball' })
    expect(spark).toMatchObject({ pattern: 'shot', visual: 'spark' })
    expect(fireball.power).toBeGreaterThan(spark.power)
    expect(fireball.cooldownMs).toBeGreaterThan(spark.cooldownMs)
    expect(spark.range).toBeGreaterThan(fireball.range)
    expect(fireball.color).not.toBe(spark.color)
    expect(arenaMoves('Loogamon', 2)[0]).toMatchObject({ visual: 'fireball', color: '#6ab8ff' })

    const grown = arenaMoves('Agumon', 6)[0]
    expect(grown.visual).toBe(fireball.visual)
    expect(grown.power).toBeGreaterThan(fireball.power)
    expect(grown.range).toBeGreaterThan(fireball.range)
    expect(grown.cooldownMs).toBeLessThan(fireball.cooldownMs)
  })

  it('define seis estilos com forças e recargas próprias para cada padrão', () => {
    const styles = Object.values(arenaMoveStyles)
    expect(styles).toHaveLength(30)
    expect(new Set(styles.map(style => style.label)).size).toBe(30)
    expect(new Set(styles.map(style => style.color)).size).toBe(30)
    for (const pattern of ['shot', 'spread', 'pierce', 'burst', 'slash']) {
      const variants = styles.filter(style => style.pattern === pattern)
      expect(variants).toHaveLength(6)
      expect(new Set(variants.map(style => style.powerScale)).size).toBe(6)
      expect(new Set(variants.map(style => style.cooldownScale)).size).toBe(6)
    }
  })

  it('tem um efeito visual implementado para cada um dos 30 estilos', () => {
    const arena = readFileSync(new URL('./Arena.vue', import.meta.url), 'utf8')
    for (const visual of Object.keys(arenaMoveStyles)) expect(arena).toContain('.fx-' + visual + '{')
  })

  it('oferece três opções válidas e taticamente diferentes para cada forma do catálogo', () => {
    const patterns = new Set<ArenaMovePattern>()
    const visuals = new Set<ArenaMoveVisual>()
    for (const template of templates) {
      for (const partner of template.characters) {
        const moves = arenaMoves(partner.name, partner.stage, template.id)
        expect(new Set(moves.map(move => move.name)).size).toBe(3)
        expect(new Set(moves.map(move => move.pattern)).size).toBe(3)
        for (const move of moves) {
          const style = arenaMoveStyles[move.visual]
          expect(style.pattern).toBe(move.pattern)
          expect(style.label).toBe(move.visualLabel)
          expect(move.color).toMatch(/^#[0-9a-f]{6}$/)
          expect(move.power).toBeGreaterThan(0)
          expect(move.range).toBeGreaterThan(7)
          expect(move.range).toBeLessThan(50)
          expect(move.cooldownMs).toBeGreaterThan(450)
          expect(move.cooldownMs).toBeLessThan(1200)
          patterns.add(move.pattern)
          visuals.add(move.visual)
        }
      }
    }
    expect(patterns).toEqual(new Set(['shot', 'spread', 'pierce', 'burst', 'slash']))
    expect(visuals).toEqual(new Set(Object.keys(arenaMoveStyles)))
  })
})
