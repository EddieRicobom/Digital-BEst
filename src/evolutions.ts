import templates from './templates.json'

type Template = typeof templates[number]
export interface MixedEvolution {
  key: string
  sourceId: string
  sourceName: string
  sourceType: string
  from: number
  to: number
  target: Template['characters'][number]
  minutes: number
  vital: number
  trophies: number
  battles: number
  winRatio: number
  adventureLevel: number
  crossed: boolean
}
const excludedFromMix = '843b04f90bb09dbd'
const normalName = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ')

/** Join lines only at the same named form and stage; each edge retains its own requirements. */
export function mixedEvolutions(name: string, stage: number | undefined, currentTemplateId: string): MixedEvolution[] {
  if (!name.trim()) return []
  const normal = normalName(name)
  const matches = templates.flatMap(template => {
    if (template.id === excludedFromMix && template.id !== currentTemplateId) return []
    return template.characters.filter(character => normalName(character.name) === normal && (stage === undefined || character.stage === stage))
      .flatMap(character => template.evolutions.filter(e => e.from === character.index).flatMap(e => {
        const target = template.characters.find(c => c.index === e.to)
        return target ? [{ ...e, target, sourceId: template.id, sourceName: template.name, sourceType: template.type, crossed: template.id !== currentTemplateId,
          key: `${template.id}:${e.from}:${e.to}:${e.minutes}:${e.vital}:${e.trophies}:${e.battles}:${e.winRatio}:${e.adventureLevel}` }] : []
      }))
  }).sort((a, b) => Number(a.crossed) - Number(b.crossed))
  const seen = new Set<string>()
  return matches.filter(edge => {
    const fingerprint = JSON.stringify([edge.sourceId, normalName(edge.target.name), edge.target.stage, edge.minutes, edge.vital, edge.trophies, edge.battles, edge.winRatio, edge.adventureLevel])
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
}
