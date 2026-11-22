import { describe, expect, it } from 'vitest'
import {
  CHIPS, advanceStreak, applyMissionEvent, battleRank, battleRewards, battleScore, bondLevel, bondProgress,
  chipBonuses, chipCost, chipPrice, claimMission, claimableMissions, dailyDeal, dailyStreakBonus, emptyMissions,
  ensureMissionDay, firstClearBonus, firstWinBonus, medals, nextStreakMilestone, normalizeChips, normalizeMissions,
  normalizeRecords, streakMilestone, streakMultiplier, updateRecords,
  type BattleContext, type BattleStats,
} from './progression'

const stats: BattleStats = { kills: 8, damage: 120, maxCombo: 14, hits: 31, seconds: 40, hpRatio: 0.7 }
const context: BattleContext = { won: true, adventure: true, areaLevel: 2, practice: false, streak: 0, bitsBonus: 0, xpBonus: 0 }

describe('vínculo', () => {
  it('sobe de nível nos marcos e mantém progresso contínuo', () => {
    expect(bondLevel(0)).toBe(1)
    expect(bondLevel(79)).toBe(1)
    expect(bondLevel(80)).toBe(2)
    expect(bondLevel(720)).toBe(4)
    expect(bondProgress(80)).toMatchObject({ level: 2, current: 0, needed: 240, percent: 0 })
    expect(bondProgress(200)).toMatchObject({ level: 2, current: 120, needed: 240, percent: 50 })
    expect(bondProgress(10000).percent).toBeLessThanOrEqual(100)
  })
})

describe('chips permanentes', () => {
  it('normaliza níveis, calcula custos e bônus acumulados', () => {
    const chips = normalizeChips({ attack: 2, guard: 99, haste: -3, fortune: '2', insight: 1 })
    expect(chips).toEqual({ attack: 2, guard: 5, haste: 0, fortune: 0, insight: 1 })
    expect(chipBonuses(chips)).toEqual({ attack: 0.12, hp: 0.4, haste: 0, bits: 0, xp: 0.15 })
    expect(chipCost(CHIPS[0]!, 0)).toBe(60)
    expect(chipCost(CHIPS[0]!, 4)).toBe(300)
    expect(chipCost(CHIPS[0]!, 9)).toBe(300)
  })
})

describe('oferta diária', () => {
  it('escolhe o mesmo chip com desconto durante todo o dia', () => {
    const deal = dailyDeal('2026-02-10')
    expect(dailyDeal('2026-02-10')).toEqual(deal)
    const discounted = CHIPS.find(chip => chip.id === deal.chipId)!
    const regular = CHIPS.find(chip => chip.id !== deal.chipId)!
    expect(deal.discount).toBeGreaterThanOrEqual(0.2)
    expect(chipPrice(discounted, 0, deal)).toBeLessThan(chipCost(discounted, 0))
    expect(chipPrice(regular, 0, deal)).toBe(chipCost(regular, 0))
    expect(CHIPS.some(chip => chip.id === dailyDeal('2026-02-11').chipId)).toBe(true)
  })
})

describe('sequência diária', () => {
  it('avança em dias consecutivos, mantém no mesmo dia e reinicia após lacuna', () => {
    expect(advanceStreak(0, '', '2026-01-01')).toMatchObject({ streak: 1, changed: true })
    expect(advanceStreak(3, '2026-01-01', '2026-01-01')).toMatchObject({ streak: 3, changed: false })
    expect(advanceStreak(3, '2026-01-01', '2026-01-02')).toMatchObject({ streak: 4, lastActiveDay: '2026-01-02' })
    expect(advanceStreak(9, '2026-01-01', '2026-01-03')).toMatchObject({ streak: 1 })
    expect(streakMultiplier(0)).toBe(1)
    expect(streakMultiplier(3)).toBeCloseTo(1.12)
    expect(streakMultiplier(99)).toBeCloseTo(1.48)
    expect(dailyStreakBonus(1)).toBe(20)
    expect(streakMilestone(2)).toBeNull()
    expect(streakMilestone(3)).toEqual({ milestone: 3, reward: 100 })
    expect(streakMilestone(30)?.reward).toBe(1000)
    expect(nextStreakMilestone(0)).toBe(3)
    expect(nextStreakMilestone(3)).toBe(7)
    expect(nextStreakMilestone(60)).toBeNull()
  })
})

describe('missões diárias', () => {
  it('acumula eventos, limita ao alvo e reseta quando o dia muda', () => {
    let missions = emptyMissions('2026-01-01')
    missions = applyMissionEvent(missions, { type: 'training' })
    missions = applyMissionEvent(missions, { type: 'training' })
    missions = applyMissionEvent(missions, { type: 'training' })
    missions = applyMissionEvent(missions, { type: 'steps', amount: 900 })
    missions = applyMissionEvent(missions, { type: 'steps', amount: 700 })
    expect(missions.progress).toMatchObject({ training: 2, steps: 900 })
    expect(claimableMissions(missions)).toEqual(['training'])
    expect(ensureMissionDay(missions, '2026-01-01')).toBe(missions)
    expect(ensureMissionDay(missions, '2026-01-02')).toMatchObject({
      day: '2026-01-02', progress: { steps: 0, wins: 0, training: 0, combo: 0 }, claimed: [],
    })
  })

  it('resgata uma vez apenas e informa a recompensa', () => {
    const missions = applyMissionEvent(applyMissionEvent(emptyMissions('2026-01-01'), { type: 'win' }), { type: 'win' })
    const claim = claimMission(missions, 'wins')
    expect(claim?.reward).toBe(60)
    expect(claim?.state.claimed).toEqual(['wins'])
    expect(claimMission(claim!.state, 'wins')).toBeNull()
    expect(normalizeMissions(claim!.state)).toEqual(claim!.state)
  })
})

describe('recompensas de batalha', () => {
  it('premia desempenho, área e sequência', () => {
    const base = battleRewards(stats, context)
    expect(base.rank).toBe('S')
    expect(base.stars).toBe(3)
    expect(base.bits).toBeGreaterThan(100)
    expect(base.xp).toBeGreaterThan(30)
    const streak = battleRewards(stats, { ...context, streak: 5 })
    expect(streak.bits).toBeGreaterThan(base.bits)
    const lucky = battleRewards(stats, { ...context, bitsBonus: 0.24 })
    expect(lucky.bits).toBeGreaterThan(base.bits)
    expect(battleScore(stats, context)).toBeGreaterThan(1000)
    expect(battleScore({ ...stats, syncs: 2 }, context)).toBe(battleScore(stats, context) + 300)
    expect(firstWinBonus(0)).toBe(60)
    expect(firstWinBonus(4)).toBe(120)
  })

  it('dá recompensa menor em derrota e nenhuma em treino livre', () => {
    const win = battleRewards(stats, context)
    const lossStats: BattleStats = { ...stats, hpRatio: 0, maxCombo: 4, kills: 3 }
    const loss = battleRewards(lossStats, { ...context, won: false })
    expect(loss.rank).toBe('D')
    expect(loss.bits).toBeLessThan(win.bits)
    expect(loss.bits).toBeGreaterThan(0)
    expect(battleRewards(stats, { ...context, practice: true })).toMatchObject({ bits: 0, xp: 0, stars: 0, rank: 'D' })
    expect(battleRank(stats, context)).toBe('S')
    expect(firstClearBonus(0)).toBe(130)
    expect(firstClearBonus(3)).toBe(280)
  })

  it('atualiza recordes gerais e por área', () => {
    const rewards = battleRewards(stats, context)
    const records = updateRecords(normalizeRecords(null), stats, context, rewards)
    expect(records).toMatchObject({
      bestScore: rewards.score, bestCombo: 14, battles: 1, wins: 1, kills: 8, damage: 120, bitsEarned: rewards.bits,
    })
    expect(records.bestScores['2']).toBe(rewards.score)
    const weaker = updateRecords(records, { ...stats, maxCombo: 2, damage: 5 }, context, { ...rewards, score: 1 })
    expect(weaker.bestScore).toBe(rewards.score)
    expect(weaker.bestCombo).toBe(14)
    expect(weaker.bestScores['2']).toBe(rewards.score)
    const free = updateRecords(weaker, stats, { ...context, adventure: false, areaLevel: 0 }, rewards)
    expect(free.bestScores).toBe(weaker.bestScores)
  })
})

describe('normalização e medalhas', () => {
  it('descarta valores inválidos e entrega medalhas conforme os registros', () => {
    const records = normalizeRecords({
      bestScore: -5, bestCombo: 30, wins: 26, kills: 'x', damage: 12.9, bitsEarned: 2500, bestStreak: 7.9,
      bestScores: { '0': 100, '1': -2, abc: 50, '3': 'x' },
    })
    expect(records).toMatchObject({ bestScore: 0, bestCombo: 30, wins: 26, kills: 0, damage: 12, bitsEarned: 2500, bestStreak: 7 })
    expect(records.bestScores).toEqual({ '0': 100 })
    const earned = medals(records, 6, 1).filter(medal => medal.earned).map(medal => medal.id)
    expect(earned).toEqual(['first-win', 'explorer', 'chain', 'veteran', 'weekly', 'fortune', 'ultimate'])
    expect(medals(records, 2, 0, 29).find(medal => medal.id === 'legend')?.earned).toBe(false)
    expect(medals({ ...records, bestStreak: 30 }, 2, 0, 1).find(medal => medal.id === 'legend')?.earned).toBe(true)
  })
})
