// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import Arena, { type ArenaMember } from './Arena.vue'

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
function member(id: string, name: string, overrides: Partial<ArenaMember> = {}): ArenaMember {
  return { id, name, sprite: '', stage: 2, power: 0, stamina: 0, ...overrides }
}
function hp() {
  return Number(host.querySelector('.arena-health [role="progressbar"]')?.getAttribute('aria-valuenow'))
}
async function advanceToSalvo(maxTicks: number) {
  for (let tick = 0; tick < maxTicks; tick++) {
    const before = new Set(host.querySelectorAll('.projectile.hostile'))
    advance(1); await nextTick()
    const newShots = [...host.querySelectorAll('.projectile.hostile')].filter(shot => !before.has(shot))
    if (newShots.length) return newShots.length
  }
  return 0
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
  it('move com um toque e usa outro para trocar ataque e esquivar', async () => {
    app = createApp(Arena, { partner: 'Agumon', stage: 2, power: 0, stamina: 0, sprite: '' })
    app.mount(host); await nextTick()
    const stick = host.querySelector<HTMLElement>('.joystick')!
    vi.spyOn(stick, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 140, height: 140, right: 140, bottom: 140, x: 0, y: 0, toJSON() {} } as DOMRect)
    Object.assign(stick, { setPointerCapture: vi.fn(), hasPointerCapture: () => false })
    const event = (type: string, id: number, x = 120, y = 70) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true })
    const fighter = host.querySelector<HTMLElement>('.fighter')!
    stick.dispatchEvent(event('pointerdown', 1))
    advance(10); await nextTick()
    const moved = parseFloat(fighter.style.left)
    expect(moved).toBeGreaterThan(50)
    const moves = [...host.querySelectorAll<HTMLButtonElement>('.move-button')]
    moves[1]!.dispatchEvent(event('pointerdown', 2)); await nextTick()
    expect(moves[1]!.getAttribute('aria-pressed')).toBe('true')
    const dodge = button('ESQUIVAR')
    dodge.dispatchEvent(event('pointerdown', 3)); await nextTick()
    expect(dodge.disabled).toBe(true)
    advance(5); await nextTick()
    expect(parseFloat(fighter.style.left)).toBeGreaterThan(moved)
    stick.dispatchEvent(event('pointerup', 2)); advance(15); await nextTick()
    const beforeRelease = parseFloat(fighter.style.left)
    advance(5); await nextTick()
    expect(parseFloat(fighter.style.left)).toBeGreaterThan(beforeRelease)
    stick.dispatchEvent(event('pointercancel', 1)); advance(2); await nextTick()
    const stopped = fighter.style.left
    advance(5); await nextTick()
    expect(fighter.style.left).toBe(stopped)
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

describe('equipe da arena', () => {
  it('começa com o Digimon escolhido e preserva vida e ataque ao trocar', async () => {
    app = createApp(Arena, {
      team: [member('a', 'Agumon', { stamina: 3 }), member('b', 'Nyokimon', { stage: 0 })],
      initialMemberId: 'b',
    })
    app.mount(host); await nextTick()
    expect(button('Nyokimon').getAttribute('aria-pressed')).toBe('true')
    expect(button('Bolha Digital').getAttribute('aria-pressed')).toBe('true')
    button('Trio de Bolhas').click()
    advance(800); await nextTick()
    const damagedHp = hp()
    expect(damagedHp).toBeLessThan(100)
    expect(damagedHp).toBeGreaterThan(0)
    button('ESQUIVAR').click()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' })); await nextTick()
    expect(hp()).toBe(115)
    expect(button('Bafo de Brasa').getAttribute('aria-pressed')).toBe('true')
    expect(button('ESQUIVAR').disabled).toBe(true)
    button('Pausar').click(); await nextTick()
    expect(button('Nyokimon').disabled).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' })); await nextTick()
    expect(hp()).toBe(115)
    button('Retomar batalha').click(); await nextTick()
    button('Nyokimon').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', button: 0, bubbles: true, cancelable: true }))
    await nextTick()
    expect(hp()).toBe(damagedHp)
    expect(button('Trio de Bolhas').getAttribute('aria-pressed')).toBe('true')
  })

  it('registra somente quem entrou em campo na vitória e limita a equipe a quatro', async () => {
    const finish = vi.fn()
    app = createApp(Arena, {
      team: [member('a', 'Agumon', { power: 100, stamina: 200 }), member('b', 'Betamon', { power: 100 }),
        member('c', 'Patamon'), member('d', 'Wormmon'), member('e', 'Loogamon')],
      initialMemberId: 'a', onFinish: finish,
    })
    app.mount(host); await nextTick()
    expect(host.querySelectorAll('.team-member')).toHaveLength(4)
    button('Betamon').click(); advance(100); await nextTick()
    button('Agumon').click(); await nextTick()
    advance(2150); await nextTick()
    expect(finish).toHaveBeenCalledExactlyOnceWith({ won: true, participantIds: ['a', 'b'], activeMemberId: 'a' })
  })

  it('coloca um reserva vivo após um nocaute e impede a volta do derrotado', async () => {
    const finish = vi.fn()
    app = createApp(Arena, {
      team: [member('a', 'Nyokimon', { stage: 0 }), member('b', 'Agumon', { stamina: 200 }), member('c', 'Patamon')],
      onFinish: finish,
    })
    app.mount(host); await nextTick()
    for (let elapsed = 0; !button('Nyokimon').disabled && elapsed < 2200; elapsed += 50) {
      advance(50); await nextTick()
    }
    expect(button('Nyokimon').textContent).toContain('Fora de combate')
    expect(button('Nyokimon').disabled).toBe(true)
    expect(button('Agumon').getAttribute('aria-pressed')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' })); await nextTick()
    expect(button('Agumon').getAttribute('aria-pressed')).toBe('true')
    expect(finish).not.toHaveBeenCalled()
    button('Sair da batalha').click()
    expect(finish).toHaveBeenCalledExactlyOnceWith({ won: false, participantIds: ['a', 'b'], activeMemberId: 'b' })
  })

  it('encerra a batalha por derrota quando o último Digimon perde a vida', async () => {
    const finish = vi.fn()
    const team = [member('0', 'Nyokimon', { stage: 0 })]
    app = createApp(Arena, { team, onFinish: finish })
    app.mount(host); await nextTick()
    expect(host.querySelector('.arena-team')).toBeNull()
    advance(2300); await nextTick()
    expect(hp()).toBe(0)
    expect(team[0]).toEqual(member('0', 'Nyokimon', { stage: 0 }))
    expect(finish).toHaveBeenCalledExactlyOnceWith({ won: false, participantIds: ['0'], activeMemberId: '0' })
  })
})

describe('expedição Survivor', () => {
  it('abre a área zero, pausa para melhorias e só registra vitória após o chefe', async () => {
    const finish = vi.fn()
    const team = [
      member('0', 'Agumon', { power: 100, stamina: 200 }),
      member('1', 'Nyokimon', { stage: 0, power: 1, stamina: 200 }),
      member('2', 'Patamon'),
    ]
    app = createApp(Arena, { adventure: true, areaLevel: 0, team, onFinish: finish })
    app.mount(host); await nextTick()
    expect(host.querySelector('.arena-header')?.textContent).toContain('ÁREA 0')
    expect(host.querySelector('.arena-header')?.textContent).toContain('ONDA 1/3')
    expect(button('Bafo de Brasa').textContent).toContain('0.7s')

    advance(220); await nextTick()
    expect(host.querySelector('.upgrade-screen')).toBeNull()
    advance(1600); await nextTick()
    expect(host.querySelector('.arena-header')?.textContent).toContain('6/6 DERROTADOS')
    expect(host.querySelectorAll('.upgrade-button')).toHaveLength(3)
    expect(host.querySelectorAll('.projectile')).toHaveLength(0)
    const firstWave = host.querySelector('.arena-field')?.innerHTML
    expect(button('Nyokimon').disabled).toBe(true)
    expect(button('ESQUIVAR').disabled).toBe(true)
    advance(2400); await nextTick()
    expect(host.querySelector('.arena-field')?.innerHTML).toBe(firstWave)
    expect(finish).not.toHaveBeenCalled()

    button('Recarga rápida').click(); await nextTick()
    expect(host.querySelector('.arena-header')?.textContent).toContain('ONDA 2/3')
    expect(button('Bafo de Brasa').textContent).toContain('0.5s')
    expect(button('Nyokimon').disabled).toBe(false)
    advance(1800); await nextTick()
    expect(host.querySelector('.arena-header')?.textContent).toContain('9/9 DERROTADOS')
    button('Canhão auxiliar').click()
    advance(2300); await nextTick()
    expect(host.querySelector('.arena-header')?.textContent).toContain('13/13 DERROTADOS')
    expect(finish).not.toHaveBeenCalled()

    button('Alcance ampliado').click(); await nextTick()
    button('Nyokimon').click()
    advance(420); await nextTick()
    expect(host.querySelector('.arena-header')?.textContent).toContain('CHEFE')
    expect(host.querySelector('.boss-hp')?.getAttribute('aria-valuemax')).toBe('48')
    expect(host.querySelectorAll('.projectile.hostile').length).toBeGreaterThanOrEqual(5)
    expect(finish).not.toHaveBeenCalled()

    const aim = '.boss.warning .enemy-aim'
    let wasAimed = false
    for (let elapsed = 0; !host.querySelector('.boss.enraged') && elapsed < 1500; elapsed++) {
      wasAimed = Boolean(host.querySelector(aim))
      advance(1); await nextTick()
    }
    expect(wasAimed).toBe(true)
    expect(host.querySelector(aim)).not.toBeNull()
    expect(host.querySelector('.boss-hud')?.textContent).toContain('FÚRIA')
    expect(await advanceToSalvo(43)).toBe(5)
    let recovery = 0
    while (!host.querySelector('.boss.warning') && recovery < 138) {
      advance(1); await nextTick()
      recovery++
    }
    expect(recovery).toBe(95)
    expect(host.querySelector(aim)).toBeNull()
    expect(await advanceToSalvo(38)).toBe(12)

    button('Agumon').click()
    advance(1500); await nextTick()
    expect(finish).toHaveBeenCalledExactlyOnceWith({ won: true, participantIds: ['0', '1'], activeMemberId: '0' })
  })

  it.each([
    { ap: 900, expectedKills: 0 },
    { ap: 2200, expectedKills: 1 },
  ])('normaliza HP e aplica AP real $ap ao golpe automático', async ({ ap, expectedKills }) => {
    const agumon = member('0', 'Agumon', { baseAttack: ap, baseHp: 4500, stamina: 3 })
    app = createApp(Arena, { adventure: true, areaLevel: 0, team: [agumon] })
    app.mount(host); await nextTick()
    expect(hp()).toBe(165)
    advance(325); await nextTick()
    expect(host.querySelector('.arena-header')?.textContent).toContain(`${expectedKills}/6 DERROTADOS`)
    expect(agumon.baseHp).toBe(4500)
  })

  it('mantém a recarga do golpe ao trocar entre quatro Digimon', async () => {
    const team = [member('0', 'Agumon'), member('1', 'Patamon'), member('2', 'Jellymon'), member('3', 'Wormmon')]
    app = createApp(Arena, { adventure: true, team })
    app.mount(host); await nextTick()
    advance(5); await nextTick()
    expect(button('Bafo de Brasa').textContent).toContain('Fora de alcance')
    advance(253); await nextTick()
    const shots = () => [...host.querySelectorAll('.projectile:not(.hostile)')]
    const firstShot = shots()[0]
    expect(firstShot).toBeDefined()
    expect(button('Bafo de Brasa').textContent).not.toContain('Fora de alcance')
    for (const name of ['Patamon', 'Jellymon', 'Wormmon']) {
      button(name).click()
      advance(1); await nextTick()
      expect(button(name).getAttribute('aria-pressed')).toBe('true')
      expect(shots()).toEqual([firstShot])
    }
    advance(29); await nextTick()
    expect(shots()).toHaveLength(0)
    advance(1); await nextTick()
    expect(shots()).toHaveLength(1)
    expect(shots()[0]).not.toBe(firstShot)
  })

  it.each([
    { areaLevel: 1, guardian: 'Canoweissmon', bossHp: '55' },
    { areaLevel: 2, guardian: 'Amphimon', bossHp: '62' },
  ])('apresenta o guardião $guardian na área $areaLevel', async ({ areaLevel, guardian, bossHp }) => {
    const team = [member('0', 'Agumon', { power: 100, stamina: 200 })]
    app = createApp(Arena, { adventure: true, areaLevel, team })
    app.mount(host); await nextTick()
    for (let wave = 0; wave < 3; wave++) {
      advance(2000); await nextTick()
      button('Alcance ampliado').click()
    }
    advance(45); await nextTick()
    const boss = host.querySelector('.boss-hp')
    expect(boss?.getAttribute('aria-label')).toBe(`Vida de ${guardian}`)
    expect(boss?.getAttribute('aria-valuemax')).toBe(bossHp)
  })

  it('encerra a expedição por derrota quando todos os Digimon caem', async () => {
    const finish = vi.fn()
    const team = [member('0', 'Nyokimon', { stage: 0 }), member('1', 'Pafumon', { stage: 0 })]
    app = createApp(Arena, { adventure: true, areaLevel: 12, team, onFinish: finish })
    app.mount(host); await nextTick()
    advance(2600); await nextTick()
    expect(finish).toHaveBeenCalledExactlyOnceWith({ won: false, participantIds: ['0', '1'], activeMemberId: '1' })
    expect(button('Nyokimon').disabled).toBe(true)
    expect(button('Pafumon').disabled).toBe(true)
  })
})
