import { Capacitor } from '@capacitor/core'
import { Health, type HealthDataType, type QueryAggregatedOptions } from '@capgo/capacitor-health'

const metrics = ['steps', 'calories'] as const
type ActivityMetric = typeof metrics[number]
const readPermissions = [...metrics, 'distance', 'workouts'] as const
export type HealthTotalSource = 'selected' | 'combined' | null

interface ActivityTotal {
  value: number | null
  source: HealthTotalSource
}

export interface HealthResult {
  steps: number | null
  calories: number | null
  distanceMeters: number | null
  exerciseMinutes: number | null
  exerciseTypes: string[]
  day: string
  denied: HealthDataType[]
  failed: HealthDataType[]
  sources: Record<ActivityMetric | 'distance', HealthTotalSource>
}

const unavailable: ActivityTotal = { value: null, source: null }
const sourceSampleLimit = 100
export const betterMiFitnessSyncPackage = 'com.bettermifitness.sync'

interface ActivitySource {
  name: string
  detail: string | null
}

export type ActivitySourceResult = {
  dataType: ActivityMetric
} & ({ status: 'read'; sources: ActivitySource[] } | { status: 'denied' | 'failed' })

async function ensureHealthAvailable() {
  if (Capacitor.getPlatform() !== 'android') throw new Error('A sincronização precisa do aplicativo Android instalado. No navegador ela não está disponível.')
  const availability = await Health.isAvailable()
  if (!availability.available) throw new Error('Health Connect indisponível. Instale ou atualize o Health Connect e tente novamente.')
}

function todayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const day = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  return { day, startDate: start.toISOString(), endDate: now.toISOString() }
}

export async function syncHealth(sourceId?: string): Promise<HealthResult> {
  await ensureHealthAvailable()
  const auth = await Health.requestAuthorization({ read: [...readPermissions] })
  const { day, startDate, endDate } = todayRange()
  const denied = readPermissions.filter(metric => !auth.readAuthorized.includes(metric))
  const read = async (dataType: ActivityMetric | 'distance'): Promise<ActivityTotal> => {
    if (!auth.readAuthorized.includes(dataType) || startDate === endDate) return unavailable
    const options: QueryAggregatedOptions = {
      dataType,
      startDate,
      endDate,
      bucket: 'day',
      aggregation: 'sum',
    }
    let samples = sourceId === undefined ? [] : (await Health.queryAggregated({ ...options, sourceId })).samples
    const source = samples.length ? 'selected' : 'combined'
    if (!samples.length) samples = (await Health.queryAggregated(options)).samples
    if (!samples.length) return unavailable
    if (samples.some(sample => !Number.isFinite(sample.value) || sample.value < 0)) throw new Error('Valor de atividade inválido.')
    const total = samples.reduce((sum, sample) => sum + sample.value, 0)
    if (!Number.isFinite(total)) throw new Error('Total de atividade inválido.')
    return { value: total, source }
  }
  const readExercise = async (): Promise<{ minutes: number | null; types: string[] }> => {
    if (!auth.readAuthorized.includes('workouts') || startDate === endDate) return { minutes: null, types: [] }
    const { workouts } = await Health.queryWorkouts({ startDate, endDate, limit: 0, includeAggregates: false })
    if (!workouts.length) return { minutes: null, types: [] }
    const selected = sourceId ? workouts.filter(workout => workout.sourceId === sourceId) : []
    const sessions = selected.length ? selected : workouts
    const start = Date.parse(startDate)
    const end = Date.parse(endDate)
    const intervals: Array<[number, number]> = []
    const labels: Record<string, string> = { walking: 'Caminhada', running: 'Corrida', cycling: 'Ciclismo', swimming: 'Natação', swimmingPool: 'Natação', swimmingOpenWater: 'Natação', hiking: 'Trilha', strengthTraining: 'Treino de força', yoga: 'Yoga', dance: 'Dança', elliptical: 'Elíptico', rowing: 'Remo', soccer: 'Futebol', other: 'Outro exercício' }
    const types = new Set<string>()
    for (const workout of sessions) {
      const from = Date.parse(workout.startDate)
      const to = Date.parse(workout.endDate)
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) throw new Error('Duração de exercício inválida.')
      const clippedStart = Math.max(from, start)
      const clippedEnd = Math.min(to, end)
      if (clippedEnd > clippedStart) {
        intervals.push([clippedStart, clippedEnd])
        types.add(labels[workout.workoutType] ?? 'Outro exercício')
      }
    }
    if (!intervals.length) return { minutes: null, types: [] }
    intervals.sort((a, b) => a[0] - b[0])
    let totalMilliseconds = 0
    let currentStart = 0
    let currentEnd = 0
    for (const [from, to] of intervals) {
      if (from > currentEnd) { totalMilliseconds += currentEnd - currentStart; currentStart = from; currentEnd = to }
      else currentEnd = Math.max(currentEnd, to)
    }
    totalMilliseconds += currentEnd - currentStart
    if (!Number.isFinite(totalMilliseconds)) throw new Error('Total de exercício inválido.')
    return { minutes: totalMilliseconds / 60000, types: [...types] }
  }
  const results = await Promise.allSettled([read('steps'), read('calories'), read('distance'), readExercise()])
  const failed = readPermissions.filter((_, index) => results[index]?.status === 'rejected')
  if (failed.length > 0 && failed.length + denied.length === readPermissions.length) {
    throw new Error('Não foi possível ler os dados do Health Connect. Verifique as permissões e tente novamente.')
  }
  const [stepsResult, caloriesResult, distanceResult, exerciseResult] = results
  const steps = stepsResult.status === 'fulfilled' ? stepsResult.value : unavailable
  const calories = caloriesResult.status === 'fulfilled' ? caloriesResult.value : unavailable
  const distance = distanceResult.status === 'fulfilled' ? distanceResult.value : unavailable
  const exercise = exerciseResult.status === 'fulfilled' ? exerciseResult.value : { minutes: null, types: [] }
  return {
    steps: steps.value,
    calories: calories.value,
    distanceMeters: distance.value,
    exerciseMinutes: exercise.minutes,
    exerciseTypes: exercise.types,
    day,
    denied,
    failed,
    sources: { steps: steps.source, calories: calories.source, distance: distance.source },
  }
}

export async function readActivitySources(): Promise<ActivitySourceResult[]> {
  await ensureHealthAvailable()
  const { readAuthorized } = await Health.checkAuthorization({ read: [...metrics] })
  const { startDate, endDate } = todayRange()
  return Promise.all(metrics.map(async (dataType): Promise<ActivitySourceResult> => {
    if (!readAuthorized.includes(dataType)) return { dataType, status: 'denied' }
    if (startDate === endDate) return { dataType, status: 'read', sources: [] }
    try {
      const { samples } = await Health.readSamples({ dataType, startDate, endDate, limit: sourceSampleLimit, ascending: false })
      const sources = new Map<string, ActivitySource>()
      for (const sample of samples) {
        const name = sample.sourceName?.trim() || null
        const id = sample.sourceId?.trim() || null
        const phone = id?.startsWith('com.android.healthconnect.phone.') || (dataType === 'steps' && id === 'android')
        const source = phone
          ? { name: 'Este celular (Health Connect)', detail: name === id ? null : name }
          : { name: name || id || 'Origem não identificada', detail: name && id && name !== id ? id : null }
        sources.set(JSON.stringify([source.name, source.detail]), source)
      }
      return { dataType, status: 'read', sources: [...sources.values()] }
    } catch {
      return { dataType, status: 'failed' }
    }
  }))
}
