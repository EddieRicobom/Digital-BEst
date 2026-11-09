// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import Arena from './Arena.vue'

let app: App
let host: HTMLDivElement
let now: number
let callbacks: Map<number, FrameRequestCallback>
let nextFrame: number
function advance(ticks: number) {
  for (let i = 0; i < ticks; i++) {
    now += 20
    const batch = [...callbacks.values()]
    callbacks.clear()
    batch.forEach(callback => callback(now))
  }
}
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find(item => item.textContent?.includes(text))
  if (!found) throw new Error(`Botão não encontrado: ${text}`)
  return found
}
beforeEach(() => {
  now = 0; nextFrame = 0; callbacks = new Map()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++nextFrame; callbacks.set(id, callback); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  vi.spyOn(Math, 'random').mockReturnValue(.5)
  host = document.createElement('div'); document.body.appendChild(host)
})
afterEach(() => { app?.unmount(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('controles da arena', () => {
  it('troca o ataque e aplica recarga à esquiva sem repetir durante a pausa', async () => {
    app = createApp(Arena, { partner: 'Agumon', stage: 2, power: 0, stamina: 0, sprite: '' })
    app.mount(host); await nextTick()
    const choices = [...host.querySelectorAll<HTMLButtonElement>('.move-button')]
    expect(choices).toHaveLength(3)
    choices[1]!.click(); await nextTick()
    expect(choices[1]!.getAttribute('aria-pressed')).toBe('true')
    const evade = button('ESQUIVAR'); evade.click(); await nextTick()
    expect(evade.disabled).toBe(true)
    button('Pausar').click(); await nextTick()
    advance(200); await nextTick()
    expect(evade.disabled).toBe(true)
    button('Retomar batalha').click(); advance(136); await nextTick()
    expect(evade.disabled).toBe(false)
  })
  it('dispara automaticamente, acerta os inimigos e registra derrotas', async () => {
    app = createApp(Arena, { partner: 'Agumon', stage: 2, power: 3, stamina: 0, sprite: '' })
    app.mount(host); await nextTick()
    advance(1100); await nextTick()
    const count = host.querySelector('.arena-header span:last-child')?.textContent?.match(/\d+/)?.[0]
    expect(Number(count)).toBeGreaterThan(0)
  })
  it('simula uma batalha completa e conclui com um resultado único', async () => {
    const finish = vi.fn()
    app = createApp(Arena, { partner: 'Nyokimon', stage: 0, power: 0, stamina: 0, sprite: '', onFinish: finish })
    app.mount(host); await nextTick()
    advance(2300); await nextTick()
    expect(finish).toHaveBeenCalledOnce()
    expect(typeof finish.mock.calls[0]?.[0]).toBe('boolean')
  })
  it('encerra somente uma vez ao sair', async () => {
    const finish = vi.fn()
    app = createApp(Arena, { partner: 'Agumon', stage: 2, power: 0, stamina: 0, sprite: '', onFinish: finish })
    app.mount(host); await nextTick()
    button('Sair da batalha').click(); button('Sair da batalha').click()
    expect(finish).toHaveBeenCalledOnce()
    expect(finish).toHaveBeenCalledWith(false)
  })
})
