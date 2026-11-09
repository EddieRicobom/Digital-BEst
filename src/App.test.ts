 // @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { newGame } from './game'
import AppView from './App.vue'

vi.mock('./Arena.vue', () => ({
  default: {
    name: 'ArenaStub', props: ['team', 'initialMemberId', 'adventure', 'areaLevel'], emits: ['finish'],
    template: '<div><button data-test-finish @click="$emit(&quot;finish&quot;, {won:true, participantIds: team.map(p => p.id), activeMemberId: team[team.length - 1].id})">Finalizar teste</button><button @click="$emit(&quot;finish&quot;, {won:true, participantIds: [team[0].id], activeMemberId: team[0].id})">Finalizar parcial</button></div>',
  },
}))
vi.mock('./AnimatedSprite.vue', () => ({ default: { name: 'AnimatedSpriteStub', template: '<span />' } }))
vi.mock('./VisualSettings.vue', () => ({ default: { name: 'VisualSettingsStub', template: '<div />' } }))

let app: App
let host: HTMLDivElement
const key = 'digital-companion-be-v1'
function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes(label))
  if (!button) throw new Error('Botão ausente: ' + label)
  button.click()
}
function saved() { return JSON.parse(localStorage.getItem(key)!) }
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ name: '', images: [], levels: [], nextEvolutions: [], priorEvolutions: [] }) })))
  host = document.createElement('div'); document.body.appendChild(host)
})
afterEach(() => { app?.unmount(); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
async function mount() { app = createApp(AppView); app.mount(host); await nextTick() }

describe('parceiros e aventura na interface', () => {
  it('migra o parceiro antigo e permite chocar outro sem substituí-lo', async () => {
    localStorage.setItem(key, JSON.stringify({ partner:'Agumon', templateId:'', characterIndex:null, egg:false, vital:123, power:3, stamina:1, battles:2, wins:1, born:100, distance:500, history:[] }))
    await mount()
    expect(host.textContent).toContain('Agumon')
    const slots = host.querySelectorAll<HTMLButtonElement>('.partner-slots button')
    expect(slots).toHaveLength(4)
    slots[1]!.click(); await nextTick()
    click('SORTEAR OVO'); await nextTick()
    expect(saved().partners[1].egg).toBe(true)
    click('CHOCAR OVO'); vi.advanceTimersByTime(2500); await nextTick()
    expect(saved().partners[1].partner).toBeTruthy()
    expect(saved().partners[0]).toMatchObject({partner:'Agumon', power:3, wins:1})
    expect(saved().vital).toBe(123)
  })
  it('consome VP compartilhados e modifica somente o parceiro treinado', async () => {
    const game = newGame(); game.vital = 100
    Object.assign(game.partners[0]!, {partner:'Agumon', power:2})
    Object.assign(game.partners[1]!, {partner:'Gabumon', power:1})
    localStorage.setItem(key, JSON.stringify(game)); await mount()
    const slots = host.querySelectorAll<HTMLButtonElement>('.partner-slots button')
    slots[1]!.click(); await nextTick()
    click('Treino de força'); await nextTick()
    expect(saved().vital).toBe(75)
    expect(saved().partners[0].power).toBe(2)
    expect(saved().partners[1].power).toBe(2)
  })
  it('mantém o ovo no mesmo espaço quando a eclosão é interrompida', async () => {
    const game = newGame()
    Object.assign(game.partners[1]!, {egg:true, templateId:'c8dacdf5b84f7f33', characterIndex:0})
    game.activePartnerIndex = 1
    localStorage.setItem(key, JSON.stringify(game)); await mount()
    click('CHOCAR OVO'); await nextTick()
    const slots = host.querySelectorAll<HTMLButtonElement>('.partner-slots button')
    expect(slots[0]!.disabled).toBe(true)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(2500); await nextTick()
    expect(saved().partners[1]).toMatchObject({egg:true, partner:''})
    hidden.mockRestore()
  })
  it('treino de equipe não gasta VP nem altera batalhas ou vitórias', async () => {
    const game = newGame(); game.vital = 200
    Object.assign(game.partners[0]!, {partner:'Agumon', power:2, battles:3, wins:1})
    Object.assign(game.partners[1]!, {partner:'Gabumon', power:1, battles:2, wins:1})
    localStorage.setItem(key, JSON.stringify(game)); await mount()
    click('AVENTURA'); await nextTick()
    click('EQUIPE'); await nextTick()
    click('TREINO GRÁTIS'); await nextTick()
    click('Finalizar teste'); await nextTick()
    expect(saved()).toMatchObject({vital:200, activePartnerIndex:1})
    expect(saved().partners[0]).toMatchObject({battles:3, wins:1})
    expect(saved().partners[1]).toMatchObject({battles:2, wins:1})
  })
  it('não registra vitória para um membro que nunca entrou em campo', async () => {
    const game = newGame(); game.vital = 200
    Object.assign(game.partners[0]!, {partner:'Agumon', battles:3, wins:1})
    Object.assign(game.partners[1]!, {partner:'Gabumon', battles:2, wins:1})
    localStorage.setItem(key, JSON.stringify(game)); await mount()
    click('AVENTURA'); await nextTick(); click('EQUIPE'); await nextTick()
    click('BATALHA LIVRE'); await nextTick(); click('Finalizar parcial'); await nextTick()
    expect(saved().partners[0]).toMatchObject({battles:4, wins:2})
    expect(saved().partners[1]).toMatchObject({battles:2, wins:1})
  })
  it('não permite avançar a área de um parceiro que já está em outra etapa', async () => {
    const game = newGame(); game.vital = 200; game.distance = 1000
    Object.assign(game.partners[0]!, {partner:'Agumon', adventureLevel:-1, battles:3, wins:1})
    Object.assign(game.partners[1]!, {partner:'Gabumon', adventureLevel:0, battles:2, wins:1})
    localStorage.setItem(key, JSON.stringify(game)); await mount()
    click('AVENTURA'); await nextTick(); click('EQUIPE'); await nextTick()
    click('SURVIVOR'); await nextTick(); click('Finalizar teste'); await nextTick()
    expect(saved().partners[0]).toMatchObject({battles:4, wins:2, adventureLevel:0})
    expect(saved().partners[1]).toMatchObject({battles:3, wins:2, adventureLevel:0})
  })
  it('registra as formas e avisa antes de entrar em outra linha BEM', async () => {
    const game = newGame(); game.vital = 9999; game.distance = 100000
    Object.assign(game.partners[0]!, {partner:'V-mon', templateId:'2116391691469466', characterIndex:2, born:1, power:100, stamina:100, battles:100, wins:100, adventureLevel:100, forms:[{name:'V-mon', templateId:'2116391691469466', timestamp:1}]})
    localStorage.setItem(key, JSON.stringify(game)); await mount()
    click('EVOLUÇÃO'); await nextTick()
    expect(host.textContent).toContain('Formas alcançadas')
    const edge = [...host.querySelectorAll('.evolutions article')].find(item => item.textContent?.includes('D-3 White and Yellow'))
    expect(edge?.textContent).toContain('TROCA DE BEM')
    const evolve = edge?.querySelector<HTMLButtonElement>('button')
    expect(evolve?.disabled).toBe(false)
    evolve!.click(); await nextTick()
    const updated = saved().partners[0]
    expect(updated.templateId).toBe('3087c980ed374ea7')
    expect(updated.forms).toHaveLength(2)
    expect(updated.forms[0].name).toBe('V-mon')
    expect(updated.forms[1].name).toBe(updated.partner)
  })
  it('vitória de área debita VP uma vez e conta para os participantes', async () => {
    const game = newGame(); game.vital = 200; game.distance = 1000
    Object.assign(game.partners[0]!, {partner:'Agumon', battles:3, wins:1})
    Object.assign(game.partners[1]!, {partner:'Gabumon', battles:2, wins:1})
    localStorage.setItem(key, JSON.stringify(game)); await mount()
    click('AVENTURA'); await nextTick()
    click('EQUIPE'); await nextTick()
    click('SURVIVOR'); await nextTick()
    click('Finalizar teste'); await nextTick()
    expect(saved()).toMatchObject({vital:150, activePartnerIndex:1})
    expect(saved().partners[0]).toMatchObject({battles:4, wins:2, adventureLevel:0})
    expect(saved().partners[1]).toMatchObject({battles:3, wins:2, adventureLevel:0})
  })
})
