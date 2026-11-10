import { describe, expect, it } from 'vitest'
import { getBemStats } from './bem-stats'
import templates from './templates.json'

describe('estatísticas BEM', () => {
  it('preserva os valores brutos de personagens do mesmo estágio', () => {
    expect(getBemStats('843b04f90bb09dbd', 2)).toEqual({ ap: 1050, hp: 3200, bp: 3900 })
    expect(getBemStats('843b04f90bb09dbd', 3)).toEqual({ ap: 900, hp: 3000, bp: 3900 })
  })

  it('distingue versões da mesma espécie em templates diferentes', () => {
    expect(getBemStats('843b04f90bb09dbd', 5)).toEqual({ ap: 1160, hp: 3600, bp: 5500 })
    expect(getBemStats('c56cb48ecc106463', 7)).toEqual({ ap: 1200, hp: 3200, bp: 4900 })
  })

  it('permite usar o fallback para bebês e dados de catálogo ausentes', () => {
    expect(getBemStats('843b04f90bb09dbd', 0)).toBeNull()
    expect(getBemStats('843b04f90bb09dbd', 1)).toBeNull()
    expect(getBemStats('843b04f90bb09dbd', null)).toBeNull()
    expect(getBemStats('843b04f90bb09dbd', 65535)).toBeNull()
    expect(getBemStats('template-ausente', 2)).toBeNull()
  })

  it('cobre todos os personagens batalháveis dos templates importados', () => {
    for (const template of templates.filter(template => template.type === 'BEM')) {
      for (const { index, stage, name } of template.characters) {
        const stats = getBemStats(template.id, index)
        if (stage < 2) {
          expect(stats, `${template.name} / ${name}`).toBeNull()
        } else {
          expect(stats, `${template.name} / ${name}`).not.toBeNull()
          for (const value of Object.values(stats!)) {
            expect(value).toBeGreaterThan(0)
            expect(value).toBeLessThan(65535)
          }
        }
      }
    }
  })
})
