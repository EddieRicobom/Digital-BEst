import { Capacitor } from '@capacitor/core'
import { Health, type HealthDataType } from '@capgo/capacitor-health'

export interface HealthResult {
  steps: number | null
  calories: number | null
  day: string
  denied: HealthDataType[]
  failed: HealthDataType[]
}

const metrics = ['steps', 'calories'] as const

export async function syncHealth(): Promise<HealthResult> {
  if (Capacitor.getPlatform() !== 'android') throw new Error('A sincronização precisa do aplicativo Android instalado. No navegador ela não está disponível.')
  const availability = await Health.isAvailable()
  if (!availability.available) throw new Error('Health Connect indisponível. Instale ou atualize o Health Connect e tente novamente.')
  const auth = await Health.requestAuthorization({ read: [...metrics] })
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const day = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const denied = metrics.filter(metric => !auth.readAuthorized.includes(metric))
  const read = async (dataType: typeof metrics[number]) => {
    if (!auth.readAuthorized.includes(dataType)) return null
    if (now.getTime() === start.getTime()) return null
    const { samples } = await Health.queryAggregated({
      dataType,
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      bucket: 'day',
      aggregation: 'sum',
    })
    if (!samples.length) return null
    if (samples.some(sample => !Number.isFinite(sample.value) || sample.value < 0)) throw new Error('Valor de atividade inválido.')
    const total = samples.reduce((sum, sample) => sum + sample.value, 0)
    if (!Number.isFinite(total)) throw new Error('Total de atividade inválido.')
    return total
  }
  const results = await Promise.allSettled([read('steps'), read('calories')])
  const failed = metrics.filter((_, index) => results[index]?.status === 'rejected')
  if (failed.length > 0 && failed.length + denied.length === metrics.length) {
    throw new Error('Não foi possível ler os dados do Health Connect. Verifique as permissões e tente novamente.')
  }
  const [steps, calories] = results
  return {
    steps: steps.status === 'fulfilled' ? steps.value : null,
    calories: calories.status === 'fulfilled' ? calories.value : null,
    day,
    denied,
    failed,
  }
}
