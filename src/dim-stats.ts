import stats from './dim-stats.json'

interface DimStats {
  readonly ap: number
  readonly hp: number
  readonly bp: number
}

const catalog: Partial<Record<string, Partial<Record<number, DimStats>>>> = stats

export function getDimStats(templateId: string | undefined, characterIndex: number | null | undefined): DimStats | null {
  if (!templateId || characterIndex == null || !Number.isInteger(characterIndex) || characterIndex < 0) return null
  return catalog[templateId]?.[characterIndex] ?? null
}

export function dimStatsForArena(templateId: string | undefined, characterIndex: number | null | undefined) {
  const raw = getDimStats(templateId, characterIndex)
  if (!raw) return null
  // The game maps the original DIM ranges to its battle input ranges. BP stays in its original scale.
  const ap = Math.min(12, Math.max(2, raw.ap))
  const hp = Math.min(22, Math.max(3, raw.hp))
  return { ap: 900 + (ap - 2) * 130, hp: Math.round(2500 + (hp - 3) * 4000 / 19) }
}
