import stats from './bem-stats.json'

export interface BemStats {
  readonly ap: number
  readonly hp: number
  readonly bp: number
}

const catalog: Partial<Record<string, Partial<Record<number, BemStats>>>> = stats

// Values use the original BEM scale. Babies and unmatched partners use the caller's fallback.
export function getBemStats(templateId: string | undefined, characterIndex: number | null | undefined): BemStats | null {
  if (!templateId || characterIndex == null || !Number.isInteger(characterIndex) || characterIndex < 0) return null
  return catalog[templateId]?.[characterIndex] ?? null
}
