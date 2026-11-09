import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { Health, type HealthSample, type QueryAggregatedResult } from '@capgo/capacitor-health'
import { readActivitySources, syncHealth } from './health'

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: vi.fn() } }))
vi.mock('@capgo/capacitor-health', () => ({
  Health: { isAvailable: vi.fn(), requestAuthorization: vi.fn(), checkAuthorization: vi.fn(), queryAggregated: vi.fn(), readSamples: vi.fn() },
}))

const authorize = vi.mocked(Health.requestAuthorization)
const query = vi.mocked(Health.queryAggregated)
const checkAuthorization = vi.mocked(Health.checkAuthorization)
const readSamples = vi.mocked(Health.readSamples)
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
    await expect(syncHealth()).resolves.toEqual({ steps: 0, calories: null, day: '2026-01-02', denied: ['calories'], failed: [], sources: { steps: 'combined', calories: null } })
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

  it('prioriza os agregados da fonte selecionada e recorre ao agregado geral por métrica ausente', async () => {
    const sourceId = 'com.bettermifitness.sync'
    query.mockImplementation(async options => {
      if (options.sourceId === sourceId) return options.dataType === 'steps' ? stepResult(0) : { samples: [] }
      return stepResult(100)
    })

    await expect(syncHealth(sourceId)).resolves.toMatchObject({ steps: 0, calories: 100, failed: [], sources: { steps: 'selected', calories: 'combined' } })
    expect(query).toHaveBeenCalledTimes(3)
    for (const dataType of ['steps', 'calories']) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({ dataType, sourceId, aggregation: 'sum', bucket: 'day' }))
    }
    expect(query.mock.calls.filter(([options]) => options.sourceId === undefined).map(([options]) => options.dataType)).toEqual(['calories'])
    expect(readSamples).not.toHaveBeenCalled()
  })

  it('não recorre ao agregado geral se a consulta da fonte selecionada falhar', async () => {
    const sourceId = 'com.bettermifitness.sync'
    query.mockImplementation(async options => {
      if (options.dataType === 'calories') return stepResult(12)
      throw new Error('Consulta rejeitada')
    })

    await expect(syncHealth(sourceId)).resolves.toMatchObject({ steps: null, calories: 12, failed: ['steps'], sources: { steps: null, calories: 'selected' } })
    expect(query.mock.calls.every(([options]) => options.sourceId === sourceId)).toBe(true)
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

describe('diagnóstico de fontes do Health Connect', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(localNoon)
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(Health.isAvailable).mockResolvedValue({ available: true })
    checkAuthorization.mockResolvedValue({ readAuthorized: ['steps', 'calories'], readDenied: [], writeAuthorized: [], writeDenied: [] })
  })

  afterEach(() => vi.useRealTimers())

  it('limita as leituras ao dia local e retorna rótulos de fontes por métrica', async () => {
    const sample: HealthSample = {
      dataType: 'steps', value: 20, unit: 'count', startDate: localNoon.toISOString(), endDate: localNoon.toISOString(),
      sourceName: 'Mi Band', sourceId: 'com.xiaomi.wearable',
    }
    readSamples.mockImplementation(async ({ dataType }) => ({ samples: dataType === 'steps'
      ? [sample, { ...sample, value: 40 }, { ...sample, sourceName: undefined, sourceId: 'android' }]
      : [] }))

    await expect(readActivitySources()).resolves.toEqual([
      { dataType: 'steps', status: 'read', sources: [{ name: 'Mi Band', detail: 'com.xiaomi.wearable' }, { name: 'Este celular (Health Connect)', detail: null }] },
      { dataType: 'calories', status: 'read', sources: [] },
    ])
    expect(checkAuthorization).toHaveBeenCalledExactlyOnceWith({ read: ['steps', 'calories'] })
    expect(readSamples).toHaveBeenCalledTimes(2)
    for (const dataType of ['steps', 'calories']) {
      expect(readSamples).toHaveBeenCalledWith({ dataType, startDate: new Date(2026, 0, 2).toISOString(), endDate: localNoon.toISOString(), limit: 100, ascending: false })
    }
    expect(authorize).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('identifica a fonte nativa do celular sem expor seu identificador técnico', async () => {
    const sourceId = 'com.android.healthconnect.phone.jd5bdd37e1a8d3667a05d0abebfc4a89e'
    readSamples.mockImplementation(async ({ dataType }) => ({
      samples: [{
        dataType, value: 20, unit: 'count', startDate: localNoon.toISOString(), endDate: localNoon.toISOString(),
        sourceId,
        sourceName: dataType === 'steps' ? ' POCO F7 ' : sourceId,
      }],
    }))

    await expect(readActivitySources()).resolves.toEqual([
      { dataType: 'steps', status: 'read', sources: [{ name: 'Este celular (Health Connect)', detail: 'POCO F7' }] },
      { dataType: 'calories', status: 'read', sources: [{ name: 'Este celular (Health Connect)', detail: null }] },
    ])
  })

  it('distingue falta de autorização de falha de leitura', async () => {
    checkAuthorization.mockResolvedValue({ readAuthorized: ['steps'], readDenied: ['calories'], writeAuthorized: [], writeDenied: [] })
    readSamples.mockRejectedValue(new Error('Consulta rejeitada'))

    await expect(readActivitySources()).resolves.toEqual([
      { dataType: 'steps', status: 'failed' },
      { dataType: 'calories', status: 'denied' },
    ])
    expect(readSamples).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ dataType: 'steps' }))
  })
})
