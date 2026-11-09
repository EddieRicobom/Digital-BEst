export const PARTNER_LIMIT = 4

export interface FormRecord {
  name: string
  templateId: string | null
  timestamp: number | null
}

export interface Partner {
  partner: string
  templateId: string
  characterIndex: number | null
  egg: boolean
  born: number
  power: number
  stamina: number
  battles: number
  wins: number
  adventureLevel: number
  history: string[]
  forms: FormRecord[]
}

export interface Game {
  version: 2
  partners: Partner[]
  activePartnerIndex: number
  vital: number
  distance: number
  lastDay: string
  creditedSteps: number
  creditedCalories: number
  steps: number | null
  calories: number | null
  updated: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validActivity(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function validPartnerIndex(index: unknown): index is number {
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < PARTNER_LIMIT
}

function formRecord(name: string, templateId: unknown, timestamp: unknown): FormRecord {
  return {
    name: name.trim(),
    templateId: typeof templateId === 'string' && templateId.trim() ? templateId : null,
    timestamp: validActivity(timestamp),
  }
}

function formHistory(history: string[], templateId: string | null): FormRecord[] {
  const forms: FormRecord[] = []
  // The diary is stored newest first; forms are recorded in chronological order.
  for (const entry of [...history].reverse()) {
    const birth = /^(.+) nasceu do ovo misterioso\.$/.exec(entry)
    if (birth) forms.push(formRecord(birth[1], templateId, null))

    const evolution = /^(.+?) digievoluiu para (.+)!$/.exec(entry)
    if (evolution) {
      const previous = formRecord(evolution[1], templateId, null)
      if (forms.at(-1)?.name.toLowerCase() !== previous.name.toLowerCase()) forms.push(previous)
      forms.push(formRecord(evolution[2], templateId, null))
    }
  }
  return forms.filter(form => form.name)
}

function restoreForms(value: unknown, history: string[], current: FormRecord, historyTemplateId: string | null): FormRecord[] {
  let forms: FormRecord[] = []
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (isRecord(entry) && typeof entry.name === 'string' && entry.name.trim()) {
        forms.push(formRecord(entry.name, entry.templateId, entry.timestamp))
      }
    }
  }

  const fromHistory = forms.length === 0
  if (fromHistory) forms = formHistory(history, historyTemplateId)
  if (current.name) {
    const latest = forms.at(-1)
    const sameName = latest?.name.toLowerCase() === current.name.toLowerCase()
    const differentTemplate = latest?.templateId && current.templateId && latest.templateId !== current.templateId
    if (!sameName || differentTemplate) forms.push(current)
    else if (fromHistory) forms[forms.length - 1] = current
  }
  return forms
}

export function recordForm(partner: Partner, name: string, templateId: string | null = null, timestamp: number | null = null): void {
  const form = formRecord(name, templateId, timestamp)
  if (partner.egg || !form.name) return
  const latest = partner.forms.at(-1)
  if (latest?.name === form.name && latest.templateId === form.templateId && latest.timestamp === form.timestamp) return
  partner.forms.push(form)
}

function restorePartner(value: unknown, legacy: boolean): Partner {
  const saved = isRecord(value) ? value : {}
  const partner = typeof saved.partner === 'string' ? saved.partner : ''
  const templateId = typeof saved.templateId === 'string' ? saved.templateId : ''
  const egg = saved.egg === true
  const born = validActivity(saved.born)
  const characterIndex = validActivity(saved.characterIndex)
  const adventureLevel = validActivity(saved.adventureLevel)
  const history = Array.isArray(saved.history) ? saved.history.filter(entry => typeof entry === 'string') : []
  const currentForm = formRecord(partner, templateId, born)
  return {
    partner,
    templateId,
    characterIndex: Number.isInteger(characterIndex) ? characterIndex : null,
    egg,
    born: born ?? Date.now(),
    power: validActivity(saved.power) ?? 0,
    stamina: validActivity(saved.stamina) ?? 0,
    battles: validActivity(saved.battles) ?? 0,
    wins: validActivity(saved.wins) ?? 0,
    adventureLevel: adventureLevel !== null && Number.isInteger(adventureLevel) ? adventureLevel : -1,
    history,
    // The single-partner save format kept the same template through every evolution.
    forms: egg ? [] : restoreForms(saved.forms, history, currentForm, legacy ? currentForm.templateId : null),
  }
}

export function migrateGame(value: unknown): Game {
  const saved = isRecord(value) ? value : {}
  const legacy = saved.version !== 2
  const savedPartners = !legacy && Array.isArray(saved.partners) ? saved.partners : [saved]
  return {
    version: 2,
    partners: Array.from({ length: PARTNER_LIMIT }, (_, index) => restorePartner(savedPartners[index], legacy)),
    activePartnerIndex: !legacy && validPartnerIndex(saved.activePartnerIndex) ? saved.activePartnerIndex : 0,
    vital: validActivity(saved.vital) ?? 0,
    distance: validActivity(saved.distance) ?? 0,
    lastDay: typeof saved.lastDay === 'string' ? saved.lastDay : '',
    creditedSteps: validActivity(saved.creditedSteps) ?? 0,
    creditedCalories: validActivity(saved.creditedCalories) ?? 0,
    steps: validActivity(saved.steps),
    calories: validActivity(saved.calories),
    updated: typeof saved.updated === 'string' ? saved.updated : null,
  }
}

export function newGame(): Game {
  return migrateGame(null)
}

export function activePartner(game: Game): Partner {
  return game.partners[game.activePartnerIndex]
}

export function switchPartner(game: Game, index: number): Game {
  if (!validPartnerIndex(index) || index === game.activePartnerIndex) return game
  return { ...game, activePartnerIndex: index }
}

export function applyHealth(g: Game, day: string, steps: number | null, calories: number | null): Game {
  // A late response for an older local day must not reset the current day's credits.
  if (day < g.lastDay) return g

  const same = g.lastDay === day
  const oldSteps = same ? validActivity(g.creditedSteps) ?? 0 : 0
  const oldCalories = same ? validActivity(g.creditedCalories) ?? 0 : 0
  steps = validActivity(steps)
  calories = validActivity(calories)
  const nextSteps = Math.max(oldSteps, steps ?? 0)
  const nextCalories = Math.max(oldCalories, calories ?? 0)
  const gained = Math.floor(nextSteps / 10) - Math.floor(oldSteps / 10) + Math.floor(nextCalories) - Math.floor(oldCalories)
  return { ...g, lastDay: day, steps, calories, creditedSteps: nextSteps, creditedCalories: nextCalories, distance: g.distance + (nextSteps - oldSteps), vital: Math.min(9999, g.vital + gained), updated: new Date().toISOString() }
}

export interface EvolutionRequirements { minutes: number; vital: number; trophies: number; battles: number; winRatio: number; adventureLevel: number }
export function evolutionProgress(g: Game, requirement: EvolutionRequirements, now: number) {
  const { born, battles, wins, power, stamina, adventureLevel } = activePartner(g)
  const elapsed = Math.max(0, Math.floor((now - born) / 60000))
  const ratio = battles ? 100 * wins / battles : 0
  const areaMet = requirement.adventureLevel === 65535 || adventureLevel >= requirement.adventureLevel
  const items = [
    { label: 'Tempo', current: elapsed, required: requirement.minutes, unit: 'min', met: elapsed >= requirement.minutes },
    { label: 'Pontos vitais', current: g.vital, required: requirement.vital, unit: 'VP', met: g.vital >= requirement.vital },
    { label: 'Treinos', current: power + stamina, required: requirement.trophies, unit: '', met: power + stamina >= requirement.trophies },
    { label: 'Batalhas', current: battles, required: requirement.battles, unit: '', met: battles >= requirement.battles },
    { label: 'Vitórias', current: Math.floor(ratio), required: requirement.winRatio, unit: '%', met: ratio >= requirement.winRatio },
  ]
  return { items, areaUnavailable: !areaMet, ready: items.every(item => item.met) && areaMet }
}
