import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { Health, type QueryAggregatedResult } from '@capgo/capacitor-health'
import { syncHealth } from './health'

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: vi.fn() } }))
vi.mock('@capgo/capacitor-health', () => ({
  Health: { isAvailable: vi.fn(), requestAuthorization: vi.fn(), queryAggregated: vi.fn() },
}))

const authorize = vi.mocked(Health.requestAuthorization)
const query = vi.mocked(Health.queryAggregated)
const localNoon = new Date(2026, 0, 2, 12)

function stepResult(value: number): QueryAggregatedResult {
  return {
    samples: [{
      startDate: new Date(2026, 0, 2).toISOString(),
      endDate: localNoon.toISOString(),
      value,
      values: { sum: value },
      unit: 'count',
    }],
  }
}

describe('leitura do Health Connect', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(localNoon)
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true })
    authorize.mockResolvedValue({ readAuthorized: ['steps', 'calories'], readDenied: [], writeAuthorized: [], writeDenied: [] })
  })

  afterEach(() => vi.useRealTimers())

  it('consulta somente os tipos autorizados desde a meia-noite local', async () => {
    authorize.mockResolvedValue({ readAuthorized: ['steps'], readDenied: ['calories'], writeAuthorized: [], writeDenied: [] })
    query.mockResolvedValue(stepResult(0))
    await expect(syncHealth()).resolves.toEqual({ steps: 0, calories: null, day: '2026-01-02', denied: ['calories'], failed: [] })
    expect(query).toHaveBeenCalledExactlyOnceWith({
      dataType: 'steps',
      startDate: new Date(2026, 0, 2).toISOString(),
      endDate: localNoon.toISOString(),
      bucket: 'day',
      aggregation: 'sum',
    })
  })

  it('preserva os passos quando a consulta de calorias falha', async () => {
    query.mockImplementation(async ({ dataType }) => {
      if (dataType === 'steps') return stepResult(123)
      throw new Error('Consulta rejeitada')
    })
    await expect(syncHealth()).resolves.toMatchObject({ steps: 123, calories: null, denied: [], failed: ['calories'] })
  })

  it('informa a falha quando nenhuma consulta autorizada funciona', async () => {
    query.mockRejectedValue(new Error('Consulta rejeitada'))
    await expect(syncHealth()).rejects.toThrow('Não foi possível ler os dados do Health Connect')
  })

  it('distingue dados ausentes de valores inválidos', async () => {
    query.mockResolvedValueOnce(stepResult(Number.NaN)).mockResolvedValueOnce({ samples: [] })
    await expect(syncHealth()).resolves.toMatchObject({ steps: null, calories: null, denied: [], failed: ['steps'] })
  })

  it('evita enviar um intervalo vazio à meia-noite', async () => {
    vi.setSystemTime(new Date(2026, 0, 2))
    await expect(syncHealth()).resolves.toMatchObject({ steps: null, calories: null, day: '2026-01-02', failed: [] })
    expect(query).not.toHaveBeenCalled()
  })

  it('bloqueia o acesso no navegador sem chamar a ponte nativa', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web')
    await expect(syncHealth()).rejects.toThrow('aplicativo Android instalado')
    expect(Health.isAvailable).not.toHaveBeenCalled()
  })
})
