export interface Game { partner: string; templateId: string; characterIndex: number | null; egg: boolean; vital: number; power: number; stamina: number; battles: number; wins: number; distance: number; adventureLevel: number; lastDay: string; creditedSteps: number; creditedCalories: number; steps: number | null; calories: number | null; updated: string | null; born: number; history: string[] }
export function newGame(): Game { return { partner: '', templateId: '', characterIndex: null, egg: false, vital: 0, power: 0, stamina: 0, battles: 0, wins: 0, distance: 0, adventureLevel: -1, lastDay: '', creditedSteps: 0, creditedCalories: 0, steps: null, calories: null, updated: null, born: Date.now(), history: [] } }

function validActivity(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null
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
  const elapsed = Math.max(0, Math.floor((now - g.born) / 60000))
  const ratio = g.battles ? 100 * g.wins / g.battles : 0
  const areaMet = requirement.adventureLevel === 65535 || g.adventureLevel >= requirement.adventureLevel
  const items = [
    { label: 'Tempo', current: elapsed, required: requirement.minutes, unit: 'min', met: elapsed >= requirement.minutes },
    { label: 'Pontos vitais', current: g.vital, required: requirement.vital, unit: 'VP', met: g.vital >= requirement.vital },
    { label: 'Treinos', current: g.power + g.stamina, required: requirement.trophies, unit: '', met: g.power + g.stamina >= requirement.trophies },
    { label: 'Batalhas', current: g.battles, required: requirement.battles, unit: '', met: g.battles >= requirement.battles },
    { label: 'Vitórias', current: Math.floor(ratio), required: requirement.winRatio, unit: '%', met: ratio >= requirement.winRatio },
  ]
  return { items, areaUnavailable: !areaMet, ready: items.every(item => item.met) && areaMet }
}
