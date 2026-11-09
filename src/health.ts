import { Capacitor } from '@capacitor/core'
import { Health, type HealthDataType, type QueryAggregatedOptions } from '@capgo/capacitor-health'

const metrics = ['steps', 'calories'] as const
type ActivityMetric = typeof metrics[number]
export type HealthTotalSource = 'selected' | 'combined' | null

interface ActivityTotal {
  value: number | null
  source: HealthTotalSource
}

export interface HealthResult {
  steps: number | null
  calories: number | null
  day: string
  denied: HealthDataType[]
  failed: HealthDataType[]
  sources: Record<ActivityMetric, HealthTotalSource>
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
  const auth = await Health.requestAuthorization({ read: [...metrics] })
  const { day, startDate, endDate } = todayRange()
  const denied = metrics.filter(metric => !auth.readAuthorized.includes(metric))
  const read = async (dataType: ActivityMetric): Promise<ActivityTotal> => {
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
  const results = await Promise.allSettled([read('steps'), read('calories')])
  const failed = metrics.filter((_, index) => results[index]?.status === 'rejected')
  if (failed.length > 0 && failed.length + denied.length === metrics.length) {
    throw new Error('Não foi possível ler os dados do Health Connect. Verifique as permissões e tente novamente.')
  }
  const [stepsResult, caloriesResult] = results
  const steps = stepsResult.status === 'fulfilled' ? stepsResult.value : unavailable
  const calories = caloriesResult.status === 'fulfilled' ? caloriesResult.value : unavailable
  return {
    steps: steps.value,
    calories: calories.value,
    day,
    denied,
    failed,
    sources: { steps: steps.source, calories: calories.source },
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
