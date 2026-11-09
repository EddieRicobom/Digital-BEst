// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { shadeSpriteFrame, useSpriteSheet } from './sprite-effects'
import { normalizeVisualPreferences, visualPreferences } from './visual-settings'

afterEach(() => {
  Object.assign(visualPreferences, normalizeVisualPreferences(null))
  vi.unstubAllGlobals()
})

describe('efeitos visuais', () => {
  it('lê preferências válidas e preserva os pixels como padrão', () => {
    expect(normalizeVisualPreferences({ gbaDisplay: 'true', smoothing: 'desconhecido' })).toEqual({
      gbaDisplay: false, smoothing: 'nitido', celShading: false,
    })
    expect(normalizeVisualPreferences({ gbaDisplay: true, smoothing: 'suave', celShading: true })).toEqual({
      gbaDisplay: true, smoothing: 'suave', celShading: true,
    })
  })

  it('mantém transparência e aplica luz no alto e sombra embaixo', () => {
    const frame = new Uint8ClampedArray(4 * 3 * 3)
    for (let i = 0; i < frame.length; i += 4) frame.set([140, 125, 110, 190], i)
    frame.set([90, 100, 110, 0], 8)
    const alpha = frame.filter((_, index) => index % 4 === 3)

    shadeSpriteFrame(frame, 3, 3)

    expect(frame.filter((_, index) => index % 4 === 3)).toEqual(alpha)
    expect([...frame.subarray(8, 12)]).toEqual([90, 100, 110, 0])
    expect(frame[0]).toBeGreaterThan(frame[16]!)
    expect(frame[32]).toBeLessThan(frame[16]!)
  })

  it('reaproveita o sprite original em erro de imagem e deixa URLs externas intactas', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('falha de rede'))
    vi.stubGlobal('fetch', fetch)
    visualPreferences.celShading = true
    const scope = effectScope()
    const externalUrl = 'https://example.com/assets/sprites/teste.png'
    const localUrl = `${import.meta.env.BASE_URL}assets/sprites/teste.png`
    try {
      const [external, local] = scope.run(() => [useSpriteSheet(() => externalUrl), useSpriteSheet(() => localUrl)])!
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      expect(fetch).toHaveBeenCalledWith(new URL(localUrl, document.baseURI).href, { mode: 'same-origin', redirect: 'error' })
      expect(external.value).toMatchObject({ url: externalUrl, celShaded: false })
      expect(local.value).toMatchObject({ url: localUrl, celShaded: false })
    } finally {
      scope.stop()
    }
  })

  it('tenta preparar a folha novamente depois de uma falha temporária', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetch)
    visualPreferences.celShading = true
    const scope = effectScope()
    const url = `${import.meta.env.BASE_URL}assets/sprites/retry.png`
    try {
      const sprite = scope.run(() => useSpriteSheet(() => url))!
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      visualPreferences.celShading = false
      await nextTick()
      visualPreferences.celShading = true
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
      expect(sprite.value.url).toBe(url)
    } finally {
      scope.stop()
    }
  })
})
