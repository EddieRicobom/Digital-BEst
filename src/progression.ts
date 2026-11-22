/**
 * Núcleo de progressão: recompensas de batalha, vínculo, missões diárias,
 * sequência de dias, chips permanentes e recordes.
 *
 * O módulo é puro para poder ser testado sem interface e para manter o save
 * previsível. A interface apenas aplica estes resultados ao estado do jogo.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedInt(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function boundedNumber(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

/* ------------------------------------------------------------------ chips */

export type ChipId = 'attack' | 'guard' | 'haste' | 'fortune' | 'insight'

export interface ChipDefinition {
  id: ChipId
  name: string
  description: string
  effect: string
  icon: string
  max: number
  costs: readonly number[]
}

export const CHIPS: readonly ChipDefinition[] = [
  {
    id: 'attack', name: 'Amplificador', icon: 'zap', max: 5,
    description: '+6% de dano em todas as batalhas por nível.',
    effect: '+6% dano/nível', costs: [60, 100, 150, 220, 300],
  },
  {
    id: 'guard', name: 'Blindagem', icon: 'shield', max: 5,
    description: '+8% de vida máxima por nível.',
    effect: '+8% HP/nível', costs: [60, 100, 150, 220, 300],
  },
  {
    id: 'haste', name: 'Circuito rápido', icon: 'timer', max: 4,
    description: '−4% no intervalo entre golpes por nível.',
    effect: '−4% recarga/nível', costs: [80, 130, 200, 300],
  },
  {
    id: 'fortune', name: 'Sorte digital', icon: 'clover', max: 4,
    description: '+12% de bits recebidos por nível.',
    effect: '+12% bits/nível', costs: [80, 130, 200, 300],
  },
  {
    id: 'insight', name: 'Sinapse', icon: 'brain', max: 4,
    description: '+15% de vínculo ganho por nível.',
    effect: '+15% vínculo/nível', costs: [70, 110, 170, 250],
  },
]

export type ChipLevels = Record<ChipId, number>

export function emptyChips(): ChipLevels {
  return { attack: 0, guard: 0, haste: 0, fortune: 0, insight: 0 }
}

export function normalizeChips(value: unknown): ChipLevels {
  const chips = emptyChips()
  if (!isRecord(value)) return chips
  for (const definition of CHIPS) chips[definition.id] = boundedInt(value[definition.id], 0, definition.max)
  return chips
}

export interface Bonuses {
  attack: number
  hp: number
  haste: number
  bits: number
  xp: number
}

export function chipBonuses(chips: ChipLevels): Bonuses {
  return {
    attack: chips.attack * 0.06,
    hp: chips.guard * 0.08,
    haste: chips.haste * 0.04,
    bits: chips.fortune * 0.12,
    xp: chips.insight * 0.15,
  }
}

export function chipCost(definition: ChipDefinition, level: number): number {
  return definition.costs[Math.max(0, Math.min(definition.max - 1, Math.floor(level)))] ?? 0
}

export interface DailyDeal {
  chipId: ChipId
  discount: number
}

/** Oferta determinística do dia: um chip com desconto, sempre o mesmo até a meia-noite. */
export function dailyDeal(day: string): DailyDeal {
  let hash = 17
  for (let index = 0; index < day.length; index++) hash = (hash * 31 + day.charCodeAt(index)) % 1000003
  const chip = CHIPS[hash % CHIPS.length]!
  const discount = [0.2, 0.25, 0.3][hash % 3]!
  return { chipId: chip.id, discount }
}

export function chipPrice(definition: ChipDefinition, level: number, deal?: DailyDeal | null): number {
  const base = chipCost(definition, level)
  return deal && deal.chipId === definition.id ? Math.max(1, Math.round(base * (1 - deal.discount))) : base
}

/* ------------------------------------------------------------------ vínculo */

/** Nível de vínculo: 2 no primeiro marco (80 XP), depois 320, 720, 1280... */
export function bondLevel(xp: number): number {
  return 1 + Math.floor(Math.sqrt(boundedNumber(xp) / 80))
}

export interface BondProgress {
  level: number
  current: number
  needed: number
  percent: number
  nextLevelXp: number
}

export function bondProgress(xp: number): BondProgress {
  const value = boundedNumber(xp)
  const level = bondLevel(value)
  const base = 80 * (level - 1) ** 2
  const next = 80 * level ** 2
  const needed = next - base
  return { level, current: value - base, needed, percent: Math.min(100, 100 * (value - base) / needed), nextLevelXp: next }
}

/* ------------------------------------------------------------------ sequência */

export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayValue(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return null
  const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isFinite(value) ? value : null
}

/** Dias inteiros entre duas datas locais no formato AAAA-MM-DD. */
export function daysBetween(from: string, to: string): number | null {
  const start = dayValue(from)
  const end = dayValue(to)
  if (start === null || end === null) return null
  return Math.round((end - start) / 86400000)
}

export interface StreakResult {
  streak: number
  lastActiveDay: string
  changed: boolean
}

export function advanceStreak(streak: number, lastActiveDay: string, day: string): StreakResult {
  const current = boundedInt(streak)
  if (lastActiveDay === day) return { streak: Math.max(1, current), lastActiveDay: day, changed: false }
  const gap = daysBetween(lastActiveDay, day)
  // Um relógio adiantado no futuro não deve apagar a sequência.
  if (gap !== null && gap < 0) return { streak: current, lastActiveDay, changed: false }
  return { streak: gap === 1 ? current + 1 : 1, lastActiveDay: day, changed: true }
}

/** +4% de bits por dia de sequência, até +48%. */
export function streakMultiplier(streak: number): number {
  return 1 + Math.min(boundedInt(streak), 12) * 0.04
}

/** Bônus automático do primeiro acesso do dia. */
export function dailyStreakBonus(streak: number): number {
  return 15 + Math.min(boundedInt(streak), 20) * 5
}

export interface StreakMilestone {
  milestone: number
  reward: number
}

const streakMilestones: Record<number, number> = { 3: 100, 7: 250, 14: 500, 30: 1000, 60: 2000 }
const streakMilestoneDays = [3, 7, 14, 30, 60] as const

/** Recompensa extra ao atingir marcos de sequência. */
export function streakMilestone(streak: number): StreakMilestone | null {
  const milestone = boundedInt(streak)
  const reward = streakMilestones[milestone]
  return reward ? { milestone, reward } : null
}

/** Próximo marco de sequência ainda não alcançado. */
export function nextStreakMilestone(streak: number): number | null {
  const current = boundedInt(streak)
  return streakMilestoneDays.find(day => day > current) ?? null
}

/* ------------------------------------------------------------------ missões */

export type MissionId = 'steps' | 'wins' | 'training' | 'combo'

export interface MissionDefinition {
  id: MissionId
  name: string
  description: string
  target: number
  reward: number
  icon: string
}

export const MISSIONS: readonly MissionDefinition[] = [
  { id: 'steps', name: 'Passos digitais', description: 'Caminhe 1.500 passos hoje', target: 1500, reward: 50, icon: 'footprints' },
  { id: 'wins', name: 'Arena aquecida', description: 'Vença 2 batalhas', target: 2, reward: 60, icon: 'trophy' },
  { id: 'training', name: 'Rotina de treino', description: 'Conclua 2 treinos', target: 2, reward: 40, icon: 'dumbbell' },
  { id: 'combo', name: 'Cadeia perfeita', description: 'Alcance um combo de 15 acertos', target: 15, reward: 80, icon: 'flame' },
]

export type MissionProgress = Record<MissionId, number>

export interface MissionState {
  day: string
  progress: MissionProgress
  claimed: MissionId[]
}

export function emptyMissions(day = ''): MissionState {
  return { day, progress: { steps: 0, wins: 0, training: 0, combo: 0 }, claimed: [] }
}

export function normalizeMissions(value: unknown): MissionState {
  if (!isRecord(value)) return emptyMissions()
  const state = emptyMissions(typeof value.day === 'string' ? value.day : '')
  const progress = isRecord(value.progress) ? value.progress : {}
  for (const definition of MISSIONS) state.progress[definition.id] = boundedInt(progress[definition.id], 0, definition.target)
  if (Array.isArray(value.claimed)) {
    for (const id of value.claimed) {
      if (typeof id === 'string' && MISSIONS.some(definition => definition.id === id) && !state.claimed.includes(id as MissionId)) {
        state.claimed.push(id as MissionId)
      }
    }
  }
  return state
}

/** Reinicia as missões quando o dia local muda. */
export function ensureMissionDay(state: MissionState, day: string): MissionState {
  return state.day === day ? state : emptyMissions(day)
}

export type MissionEvent =
  | { type: 'steps'; amount: number }
  | { type: 'win' }
  | { type: 'training' }
  | { type: 'combo'; amount: number }

export function applyMissionEvent(state: MissionState, event: MissionEvent): MissionState {
  const missionId: MissionId = event.type === 'win' ? 'wins' : event.type
  const definition = MISSIONS.find(item => item.id === missionId)
  if (!definition) return state
  const current = state.progress[missionId]
  const next = event.type === 'win' || event.type === 'training'
    ? current + 1
    : Math.max(current, boundedInt(event.amount))
  const capped = Math.min(definition.target, next)
  if (capped === current) return state
  return { ...state, progress: { ...state.progress, [missionId]: capped } }
}

export function missionDefinition(id: MissionId): MissionDefinition {
  return MISSIONS.find(item => item.id === id) ?? MISSIONS[0]!
}

export function completedMissions(state: MissionState): MissionId[] {
  return MISSIONS.filter(item => state.progress[item.id] >= item.target).map(item => item.id)
}

export function claimableMissions(state: MissionState): MissionId[] {
  return completedMissions(state).filter(id => !state.claimed.includes(id))
}

export interface MissionClaim {
  state: MissionState
  reward: number
}

export function claimMission(state: MissionState, id: MissionId): MissionClaim | null {
  const definition = MISSIONS.find(item => item.id === id)
  if (!definition || state.progress[id] < definition.target || state.claimed.includes(id)) return null
  return { state: { ...state, claimed: [...state.claimed, id] }, reward: definition.reward }
}

/* ------------------------------------------------------------------ recordes */

export interface Records {
  bestScore: number
  bestCombo: number
  battles: number
  wins: number
  kills: number
  damage: number
  bitsEarned: number
  bestStreak: number
  bestScores: Record<string, number>
}

export function emptyRecords(): Records {
  return { bestScore: 0, bestCombo: 0, battles: 0, wins: 0, kills: 0, damage: 0, bitsEarned: 0, bestStreak: 0, bestScores: {} }
}

export function normalizeRecords(value: unknown): Records {
  const records = emptyRecords()
  if (!isRecord(value)) return records
  records.bestScore = boundedInt(value.bestScore)
  records.bestCombo = boundedInt(value.bestCombo)
  records.battles = boundedInt(value.battles)
  records.wins = boundedInt(value.wins)
  records.kills = boundedInt(value.kills)
  records.damage = boundedInt(value.damage)
  records.bitsEarned = boundedInt(value.bitsEarned)
  records.bestStreak = boundedInt(value.bestStreak)
  if (isRecord(value.bestScores)) {
    for (const [key, score] of Object.entries(value.bestScores)) {
      if (/^\d+$/.test(key) && typeof score === 'number' && Number.isFinite(score) && score > 0) {
        records.bestScores[key] = Math.floor(score)
      }
    }
  }
  return records
}

export interface Medal {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

export function medals(records: Records, stage: number, areasCleared = 0, streak = 0): Medal[] {
  // Medalhas são permanentes: a maior sequência já alcançada nunca é perdida.
  const bestStreak = Math.max(boundedInt(records.bestStreak), boundedInt(streak))
  return [
    { id: 'first-win', name: 'Primeira vitória', description: 'Vença uma batalha.', icon: 'trophy', earned: records.wins >= 1 },
    { id: 'explorer', name: 'Expedicionista', description: 'Conclua uma área da expedição.', icon: 'target', earned: areasCleared >= 1 },
    { id: 'chain', name: 'Cadeia de 25', description: 'Alcance um combo de 25 acertos.', icon: 'flame', earned: records.bestCombo >= 25 },
    { id: 'veteran', name: 'Veterano', description: 'Vença 25 batalhas.', icon: 'shield', earned: records.wins >= 25 },
    { id: 'weekly', name: 'Ritmo constante', description: 'Mantenha 7 dias de sequência.', icon: 'flame', earned: bestStreak >= 7 },
    { id: 'legend', name: 'Lenda diária', description: 'Mantenha 30 dias de sequência.', icon: 'gem', earned: bestStreak >= 30 },
    { id: 'fortune', name: 'Fortuna digital', description: 'Ganhe 2.000 bits em batalhas.', icon: 'coins', earned: records.bitsEarned >= 2000 },
    { id: 'ultimate', name: 'Além do limite', description: 'Alcance o estágio máximo do seu parceiro.', icon: 'gem', earned: stage >= 6 },
  ]
}

/* ------------------------------------------------------------------ batalha */

export type BattleRank = 'S' | 'A' | 'B' | 'C' | 'D'

export interface BattleStats {
  kills: number
  damage: number
  maxCombo: number
  hits: number
  seconds: number
  hpRatio: number
  /** Quantas vezes a Sincronia foi liberada durante a batalha. */
  syncs?: number
}

export interface BattleContext {
  won: boolean
  adventure: boolean
  areaLevel: number
  practice: boolean
  streak: number
  bitsBonus: number
  xpBonus: number
}

export interface BattleRewards {
  score: number
  rank: BattleRank
  bits: number
  xp: number
  stars: number
}

export const emptyBattleStats: BattleStats = { kills: 0, damage: 0, maxCombo: 0, hits: 0, seconds: 0, hpRatio: 1 }

const rankBits: Record<BattleRank, number> = { S: 100, A: 60, B: 35, C: 15, D: 5 }
const rankXp: Record<BattleRank, number> = { S: 40, A: 28, B: 18, C: 10, D: 4 }

export function battleScore(stats: BattleStats, context: BattleContext): number {
  const area = Math.max(0, boundedInt(context.areaLevel))
  return Math.round(
    boundedInt(stats.kills) * 120 +
    boundedNumber(stats.damage) * 2 +
    Math.min(60, boundedInt(stats.maxCombo)) * 25 +
    boundedInt(stats.syncs) * 150 +
    (context.won ? 400 : 0) +
    area * 80,
  )
}

export function battleRank(stats: BattleStats, context: BattleContext): BattleRank {
  if (context.practice) return 'D'
  if (context.won) {
    const ratio = boundedNumber(stats.hpRatio, 0, 1)
    if (ratio >= 0.6 && stats.maxCombo >= 12) return 'S'
    if (ratio >= 0.35 || stats.maxCombo >= 8) return 'A'
    return 'B'
  }
  if (stats.kills >= 6 && stats.maxCombo >= 6) return 'C'
  return 'D'
}

export function battleRewards(stats: BattleStats, context: BattleContext): BattleRewards {
  const score = battleScore(stats, context)
  const rank = battleRank(stats, context)
  const area = Math.max(0, boundedInt(context.areaLevel))
  const streak = streakMultiplier(context.streak)
  const bitsBase = (context.won ? 30 : 6) +
    boundedInt(stats.kills) * 2 +
    Math.min(30, boundedInt(stats.maxCombo)) * 2 +
    area * (context.adventure ? 18 : 4) +
    rankBits[rank]
  const xpBase = (context.won ? 24 : 6) +
    boundedInt(stats.kills) * 2 +
    (context.adventure ? area * 5 : 0) +
    rankXp[rank]
  const bits = context.practice ? 0 : Math.max(1, Math.round(bitsBase * streak * (1 + boundedNumber(context.bitsBonus, 0, 5))))
  const xp = context.practice ? 0 : Math.max(1, Math.round(xpBase * (1 + boundedNumber(context.xpBonus, 0, 5))))
  const stars = context.practice || !context.won ? 0 : rank === 'S' ? 3 : rank === 'A' ? 2 : 1
  return { score, rank, bits, xp, stars }
}

/** Bônus único por concluir uma área nova. */
export function firstClearBonus(areaLevel: number): number {
  return 80 + Math.max(0, boundedInt(areaLevel) + 1) * 50
}

/** Bônus da primeira vitória do dia, cresce com a área. */
export function firstWinBonus(areaLevel: number): number {
  return 60 + Math.max(0, boundedInt(areaLevel)) * 15
}

export function updateRecords(records: Records, stats: BattleStats, context: BattleContext, rewards: BattleRewards): Records {
  const areaKey = String(Math.max(0, boundedInt(context.areaLevel)))
  const bestScores = context.adventure
    ? { ...records.bestScores, [areaKey]: Math.max(records.bestScores[areaKey] ?? 0, rewards.score) }
    : records.bestScores
  return {
    bestScore: Math.max(records.bestScore, rewards.score),
    bestCombo: Math.max(records.bestCombo, boundedInt(stats.maxCombo)),
    battles: records.battles + 1,
    wins: records.wins + (context.won ? 1 : 0),
    kills: records.kills + boundedInt(stats.kills),
    damage: records.damage + boundedInt(stats.damage),
    bitsEarned: records.bitsEarned + rewards.bits,
    bestStreak: records.bestStreak,
    bestScores,
  }
}
