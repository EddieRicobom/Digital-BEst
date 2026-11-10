<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import sprites from './sprites.json'
import { newGame, migrateGame, activePartner, switchPartner, recordForm, applyHealth, evolutionProgress, type Game, type Partner } from './game'
import { betterMiFitnessSyncPackage, readActivitySources, syncHealth, type ActivitySourceResult } from './health'
import Arena, { type ArenaMember, type ArenaBattleResult } from './Arena.vue'
import { mixedEvolutions, type MixedEvolution } from './evolutions'
import { getBemStats } from './bem-stats'
import { getDimStats, dimStatsForArena } from './dim-stats'
import VisualSettings from './VisualSettings.vue'
import AppIcon from './AppIcon.vue'
import { visualClasses } from './visual-settings'
import AnimatedSprite from './AnimatedSprite.vue'
import templates from './templates.json'

type Evolution = { id: number; digimon: string; image: string; condition: string }
type Digi = { name: string; images: { href: string }[]; levels: { level: string }[]; nextEvolutions: Evolution[]; priorEvolutions: Evolution[] }
const key = 'digital-companion-be-v1'
function load(): Game { try { const saved = localStorage.getItem(key); return saved ? migrateGame(JSON.parse(saved)) : newGame() } catch { return newGame() } }
const game = ref<Game>(load())
const selected = computed(() => activePartner(game.value))
watch(game, value => localStorage.setItem(key, JSON.stringify(value)), { deep: true })
const tab = ref<'parceiro'|'aventura'|'evolucao'|'saude'>('parceiro')
const training = ref(false)
let trainingTimer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => { if (trainingTimer) clearTimeout(trainingTimer) })
const hatching = ref(false)
let hatchTimer: ReturnType<typeof setTimeout> | undefined
function cancelHatch() { if (hatchTimer) clearTimeout(hatchTimer); hatchTimer = undefined; hatching.value = false }
function handleVisibility() { if (document.hidden && hatching.value) cancelHatch() }
onMounted(() => document.addEventListener('visibilitychange', handleVisibility))
onUnmounted(() => { cancelHatch(); document.removeEventListener('visibilitychange', handleVisibility) })
const battling = ref(false)
const areaBattle = ref(false)
const challengeArea = ref(0)
const practiceBattle = ref(false)
const battleMode = ref<'solo' | 'team'>('solo')
const combatTeam = ref<ArenaMember[]>([])
const combatInitial = ref('')
function selectSlot(index: number) {
  if (hatching.value || battling.value) return
  if (trainingTimer) clearTimeout(trainingTimer)
  training.value = false
  game.value = switchPartner(game.value, index)
  message.value = ''; digi.value = null; error.value = ''; viewed.value = ''
  if (selected.value.partner) void browse(selected.value.partner)
}
function arenaMember(partner: Partner, index: number): ArenaMember {
  const template = templates.find(item => item.id === partner.templateId)
  const character = template?.characters.find(item => item.index === partner.characterIndex)
  const gallery = sprites.find(item => item.name.toLowerCase() === partner.partner.toLowerCase())
  const stats = getBemStats(partner.templateId, partner.characterIndex)
  const dimStats = dimStatsForArena(partner.templateId, partner.characterIndex)
  return { id: String(index), name: partner.partner, stage: character?.stage ?? 2, baby: (character?.stage ?? 2) < 2,
    templateId: partner.templateId, power: partner.power, stamina: partner.stamina,
    baseAttack: stats?.ap ?? dimStats?.ap, baseHp: stats?.hp ?? dimStats?.hp, baseBp: stats?.bp,
    sprite: character ? `https://dim.digitallink.games${character.previewUrl}` : gallery ? `https://dim.digitallink.games${gallery.previewUrl}` : '',
    sheet: template && character ? `${import.meta.env.BASE_URL}assets/sprites/${template.id}/${character.index}.png` : '' }
}
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => { clock = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (clock) clearInterval(clock) })
const digi = ref<Digi | null>(null); const loading = ref(false); const error = ref(''); const syncing = ref(false); const message = ref(''); const query = ref(''); const viewed = ref('')
const readingSources = ref(false)
const activitySources = ref<ActivitySourceResult[]>([])
const sourceError = ref('')
const syncSources = ref<{steps: string | null; calories: string | null} | null>(null)
const currentSprite = computed(() => sprites.find(s => s.name.toLowerCase() === selected.value.partner.toLowerCase()))
const selectedTemplate = computed(() => templates.find(t => t.id === selected.value.templateId))
const selectedCharacter = computed(() => selectedTemplate.value?.characters.find(c => c.index === selected.value.characterIndex))
const selectedStats = computed(() => getBemStats(selected.value.templateId, selected.value.characterIndex) ?? getDimStats(selected.value.templateId, selected.value.characterIndex))
function formLineName(id: string | null) { const template = templates.find(item => item.id === id); return template ? `${template.type} · ${template.name}` : undefined }
const spriteUrl = computed(() => selectedCharacter.value ? `https://dim.digitallink.games${selectedCharacter.value.previewUrl}` : currentSprite.value ? `https://dim.digitallink.games${currentSprite.value.previewUrl}` : digi.value?.name === selected.value.partner ? digi.value.images[0]?.href : '')
const spriteSheet = computed(() => selectedTemplate.value && selectedCharacter.value ? `${import.meta.env.BASE_URL}assets/sprites/${selectedTemplate.value.id}/${selectedCharacter.value.index}.png` : '')
const eggSheet = computed(() => selectedTemplate.value ? `${import.meta.env.BASE_URL}assets/sprites/${selectedTemplate.value.id}/egg.png` : '')
const templateEvolutions = computed(() => mixedEvolutions(selected.value.partner, selectedCharacter.value?.stage, selected.value.templateId))
const choices = computed(() => (digi.value?.nextEvolutions || []).filter(x => x.digimon.toLowerCase().includes(query.value.toLowerCase())))
const areaSteps = computed(() => Math.max(0, Math.min(1000, Math.floor(game.value.distance - (selected.value.adventureLevel + 1) * 1000))))
const areaReady = computed(() => areaSteps.value >= 1000)
const canEvolve = computed(() => digi.value?.name.toLowerCase() === selected.value.partner.toLowerCase())
let browseRequest = 0
async function browse(name: string) { if (!name) return; const request = ++browseRequest; loading.value = true; error.value = ''; query.value = ''; viewed.value = name; try { const response = await fetch(`https://digi-api.com/api/v1/digimon/${encodeURIComponent(name)}`); if (!response.ok) throw new Error(); const result = await response.json() as Digi; if (request === browseRequest) digi.value = result } catch { if (request === browseRequest) { digi.value = null; error.value = 'Não foi possível carregar as evoluções. Verifique sua conexão e tente novamente.' } } finally { if (request === browseRequest) loading.value = false } }
onMounted(() => { if (selected.value.partner) void browse(selected.value.partner) })
const eggPool = templates.filter(t => t.id !== '843b04f90bb09dbd').flatMap(t => t.characters.filter(c => c.stage === 0 && t.evolutions.some(e => e.from === c.index && e.adventureLevel === 65535)).map(c => ({ t, c })))
const eggTemplateCount = new Set(eggPool.map(item => item.t.id)).size
function drawEgg() { if (!eggPool.length) { message.value = 'Nenhum ovo disponível.'; return } const pick = eggPool[Math.floor(Math.random()*eggPool.length)]!; selected.value.templateId = pick.t.id; selected.value.characterIndex = pick.c.index; selected.value.egg = true; localStorage.setItem(key, JSON.stringify(game.value)); message.value = 'Um ovo misterioso chegou! Toque em chocar para descobrir seu parceiro.' }
function hatch() {
  if (!selected.value.egg || !selectedCharacter.value || hatching.value) return
  hatching.value = true
  message.value = ''
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 2400
  hatchTimer = setTimeout(() => {
    const character = selectedCharacter.value
    if (!selected.value.egg || !character) { cancelHatch(); return }
    selected.value.partner = character.name
    selected.value.egg = false
    selected.value.born = Date.now()
    recordForm(selected.value, selected.value.partner, selected.value.templateId || null, selected.value.born)
    selected.value.history.unshift(`${selected.value.partner} nasceu do ovo misterioso.`)
    localStorage.setItem(key, JSON.stringify(game.value))
    hatching.value = false
    hatchTimer = undefined
    message.value = `${selected.value.partner} nasceu!`
    void browse(selected.value.partner)
  }, duration)
}
function evolveTemplate(e: MixedEvolution) { if (!evolutionProgress(game.value, e, Date.now()).ready) { message.value = 'Confira os requisitos pendentes desta evolução.'; return } const old=selected.value.partner; selected.value.templateId=e.sourceId; selected.value.characterIndex=e.to; selected.value.partner=e.target.name; selected.value.born=Date.now(); recordForm(selected.value, selected.value.partner, selected.value.templateId || null, selected.value.born); selected.value.power=0; selected.value.stamina=0; selected.value.battles=0; selected.value.wins=0; selected.value.history.unshift(`${old} digievoluiu para ${e.target.name}!`); message.value = `${old} digievoluiu para ${e.target.name}!`; void browse(e.target.name) }
async function sync() { syncing.value = true; message.value = ''; try { const result = await syncHealth(betterMiFitnessSyncPackage); syncSources.value = result.sources; game.value = applyHealth(game.value, result.day, result.steps, result.calories); message.value = result.failed.length ? 'Sincronização parcial: alguns dados não puderam ser consultados e aparecem como indisponíveis.' : result.denied.length ? 'Sincronizado. Algumas permissões foram negadas; dados não autorizados aparecem como indisponíveis.' : 'Sincronização concluída. Dados ausentes continuam indisponíveis.' } catch (e) { message.value = e instanceof Error ? e.message : 'Não foi possível sincronizar.' } finally { syncing.value = false } }
async function inspectActivitySources() {
  readingSources.value = true
  activitySources.value = []
  sourceError.value = ''
  try {
    activitySources.value = await readActivitySources()
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : 'Não foi possível consultar as fontes.'
  } finally {
    readingSources.value = false
  }
}
function train(kind: 'power'|'stamina') { if (game.value.vital < 25) { message.value = 'São necessários 25 pontos vitais para treinar.'; return } game.value.vital -= 25; selected.value[kind]++; training.value = true; if (trainingTimer) clearTimeout(trainingTimer); trainingTimer = setTimeout(() => { training.value = false }, 1400); selected.value.history.unshift(`Treino de ${kind === 'power' ? 'força' : 'resistência'} concluído.`); message.value = 'Treino concluído!' }
function battle(area = false, practice = false) {
  if (!selected.value.partner) { message.value = 'Selecione um parceiro que já nasceu.'; return }
  if (area && game.value.distance < (selected.value.adventureLevel + 2) * 1000) { message.value = 'Acumule passos suficientes para enfrentar a próxima área.'; return }
  if (!practice && game.value.vital < 50) { message.value = 'São necessários 50 pontos vitais compartilhados para batalhar.'; return }
  const indexes = battleMode.value === 'team' ? game.value.partners.map((_, index) => index) : [game.value.activePartnerIndex]
  const members = indexes.filter(index => game.value.partners[index]?.partner).map(index => arenaMember(game.value.partners[index]!, index))
  if (!members.length) { message.value = 'Choque pelo menos um ovo para começar.'; return }
  if (!practice) game.value.vital -= 50
  combatTeam.value = members; combatInitial.value = String(game.value.activePartnerIndex)
  challengeArea.value = selected.value.adventureLevel + 1
  areaBattle.value = area; practiceBattle.value = practice; message.value = ''; battling.value = true
}
function battleFinished(result: boolean | ArenaBattleResult) {
  battling.value = false
  const won = typeof result === 'boolean' ? result : result.won
  const ids = typeof result === 'boolean' ? [combatInitial.value] : result.participantIds
  const lastId = typeof result === 'boolean' ? combatInitial.value : result.activeMemberId
  if (!practiceBattle.value) {
    for (const id of new Set(ids)) {
      const member = game.value.partners[Number(id)]
      if (!member?.partner) continue
      member.battles++
      if (won) member.wins++
      if (won && areaBattle.value && member.adventureLevel + 1 === challengeArea.value) { member.adventureLevel = challengeArea.value; member.history.unshift(`Área ${member.adventureLevel} concluída na expedição.`) }
      else member.history.unshift(won ? 'Vitória na arena digital.' : 'Batalha encerrada na arena digital.')
    }
  }
  if (lastId !== undefined && game.value.partners[Number(lastId)]?.partner) { game.value = switchPartner(game.value, Number(lastId)); void browse(selected.value.partner) }
  message.value = practiceBattle.value ? (won ? 'Treino concluído! Esta batalha não altera os contadores.' : 'Treino encerrado. Esta batalha não altera os contadores.') : won ? (areaBattle.value ? 'Vitória! A área avançou para os parceiros que estavam nessa etapa.' : 'Vitória! Os Digimon que participaram receberam a vitória.') : 'A batalha terminou. Tente novamente!'
  areaBattle.value = false; practiceBattle.value = false; combatTeam.value = []
}
function evolve(e: Evolution) { if (!canEvolve.value || game.value.vital < 500 || selected.value.battles < 3) { message.value = 'Para digievoluir: consulte seu parceiro atual, acumule 500 vitais e participe de 3 batalhas.'; return } const old = selected.value.partner; selected.value.partner = e.digimon; game.value.vital -= 500; selected.value.born = Date.now(); recordForm(selected.value, selected.value.partner, selected.value.templateId || null, selected.value.born); selected.value.history.unshift(`${old} digievoluiu para ${e.digimon}!`); message.value = `${old} digievoluiu para ${e.digimon}!`; void browse(e.digimon); tab.value = 'parceiro' }
</script>

<template>
  <div class="app-shell" :class="[{ 'in-battle': battling }, visualClasses]">
    <header v-if="!battling" class="topbar"><div class="brand-mark">D<span>·</span></div><div><small>DIGITAL COMPANION</small><strong>BE <i>PROJECT</i></strong></div><span class="badge">PROTÓTIPO</span></header>
    <main>
      <section v-if="!battling" class="heading"><div><span class="eyebrow">SEU MUNDO DIGITAL</span><h1>{{ tab === 'parceiro' ? 'Seu parceiro' : tab === 'aventura' ? 'Aventura' : tab === 'evolucao' ? 'Digievolução' : 'Minha atividade' }}</h1></div><div class="signal">● DIGITAL LIFE</div></section>
      <div v-if="!battling" class="partner-slots" role="group" aria-label="Selecionar parceiro">
        <button v-for="(slot, index) in game.partners" :key="index" type="button" :disabled="hatching" :class="{ active: game.activePartnerIndex === index }" :aria-pressed="game.activePartnerIndex === index" @click="selectSlot(index)"><strong>{{ index + 1 }}</strong><span>{{ slot.partner || (slot.egg ? 'Ovo' : 'Vazio') }}</span></button>
      </div>
      <p v-if="message" class="notice" role="status">{{ message }}</p>
      <template v-if="tab === 'parceiro' && !selected.partner"><section class="panel egg-panel"><span class="eyebrow">UMA NOVA AVENTURA</span><h2>{{ selected.egg ? "Um ovo misterioso!" : "Um novo parceiro" }}</h2><div v-if="selected.egg" class="egg-display" :class="{ hatching }"><AnimatedSprite :sheet="eggSheet" label="Ovo digital" :frames="hatching ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1]" :interval="300" :frame-width="32" :frame-height="40" :frame-count="8" /></div><div v-else class="egg-symbol" aria-hidden="true">?</div><p v-if="hatching" role="status">O ovo está chocando…</p><p v-else>{{ selected.egg ? "Um template e um bebê foram sorteados. Choque o ovo para descobrir seu parceiro e sua linha." : 'Sorteie um ovo entre ' + eggTemplateCount + ' linhas BEM e DIM disponíveis.' }}</p><button class="primary" v-if="!selected.egg" @click="drawEgg">SORTEAR OVO</button><button class="primary" v-else :disabled="hatching" @click="hatch">{{ hatching ? "CHOCANDO…" : "CHOCAR OVO" }}</button></section></template><template v-else-if="tab === 'parceiro'">
        <section class="device"><div class="device-top"><span>PARTNER / 0{{ game.activePartnerIndex + 1 }}</span><span>● DIGITAL LIFE</span></div><div class="screen"><div class="screen-grid"></div><div class="screen-meta"><span>VITAL BRACELET</span><span>BE</span></div><div class="sprite-wrap"><AnimatedSprite :sheet="spriteSheet" :fallback="spriteUrl || ''" :label="selected.partner" :frames="training ? ((selectedCharacter?.stage ?? 2) < 2 ? [0, 8] : [6, 7]) : [0, 1]" :interval="350" /></div><div class="screen-bottom"><span>PARTNER ONLINE</span><span>◆ ◆ ◆</span></div></div><div class="partner-info"><div><small>SEU PARCEIRO</small><h2>{{ selected.partner }}</h2><p>{{ digi?.name === selected.partner ? digi.levels.map(x => x.level).join(' / ') : 'Digimon' }}</p></div><div class="vital"><small>VITAL POINTS</small><strong>{{ game.vital.toLocaleString('pt-BR') }}</strong><span>VP</span></div></div><p class="credit" v-if="selectedTemplate">Template e sprite: {{ selectedTemplate.name }} · Digital Link</p><p class="credit" v-else-if="currentSprite">Sprite: {{ currentSprite.author }} · Digital Link</p><p class="credit" v-else>Imagem Digi-API quando disponível</p></section>
        <div class="stats"><div><small>FORÇA</small><strong>{{ selected.power }}</strong><span>treinos</span></div><div><small>RESISTÊNCIA</small><strong>{{ selected.stamina }}</strong><span>treinos</span></div><div><small>VITÓRIAS</small><strong>{{ selected.wins }}</strong><span>{{ selected.battles }} batalhas</span></div></div>
        <section class="panel" v-if="selectedStats"><span class="eyebrow">DADOS DO TEMPLATE {{ selectedTemplate?.type || 'BEM' }}</span><h3>Atributos originais</h3><div class="stats"><div><small>AP</small><strong>{{ selectedStats.ap }}</strong><span>ataque</span></div><div><small>HP</small><strong>{{ selectedStats.hp }}</strong><span>vida</span></div><div><small>BP</small><strong>{{ selectedStats.bp }}</strong><span>valor BEM</span></div></div><p class="muted">AP e HP são adaptados à escala da arena. BP é exibido na escala original.</p></section><p v-else class="muted">Este estágio não tem atributos disponíveis; a arena usa valores iniciais.</p><section class="panel"><div class="section-title"><div><span class="eyebrow">MAIS FORTE A CADA DIA</span><h3>Treinar parceiro</h3></div><span class="pill">25 VP</span></div><div class="actions"><button @click="train('power')"><AppIcon name="power" :size="21" /><span>Treino de força<small>Aumenta AP</small></span><strong>↗</strong></button><button @click="train('stamina')"><AppIcon name="stamina" :size="21" /><span>Treino de resistência<small>Aumenta HP</small></span><strong>↗</strong></button></div></section>
      </template>
      <template v-else-if="tab === 'aventura' && !selected.partner"><section class="panel"><p>Choque seu ovo antes de começar a aventura.</p></section></template><template v-else-if="tab === 'aventura'"><Arena v-if="battling" :team="combatTeam" :initial-member-id="combatInitial" :adventure="areaBattle" :area-level="challengeArea" @finish="battleFinished" /><template v-else><section class="panel adventure"><span class="eyebrow">EXPEDIÇÃO</span><h2>Área {{ selected.adventureLevel + 1 }}</h2>
      <div class="progress-head"><span>PASSOS PARA A ÁREA</span><strong>{{ areaSteps.toLocaleString('pt-BR') }} / 1.000</strong></div>
      <div class="progress" role="progressbar" aria-label="Passos para a próxima área" :aria-valuenow="areaSteps" aria-valuemin="0" aria-valuemax="1000"><span :style="{width: areaSteps / 10 + '%'}"></span></div>
      <div class="battle-mode" role="group" aria-label="Modo de batalha"><button type="button" :aria-pressed="battleMode === 'solo'" :class="{ active: battleMode === 'solo' }" @click="battleMode = 'solo'">SOLO</button><button type="button" :aria-pressed="battleMode === 'team'" :class="{ active: battleMode === 'team' }" @click="battleMode = 'team'">EQUIPE · {{ game.partners.filter(p => p.partner).length }}</button></div>
      <p class="muted">Equipe: troque de Digimon durante a luta; cada um tem sua própria vida.</p>
      <button class="primary" :disabled="!areaReady" @click="battle(true)">SURVIVOR · ÁREA {{ selected.adventureLevel + 1 }} · 50 VP</button>
      <button class="secondary-battle" @click="battle(false)">BATALHA LIVRE · 50 VP</button>
      <button class="secondary-battle" @click="battle(false, true)">TREINO GRÁTIS · SEM VP OU VITÓRIAS</button>
      </section><section class="panel"><div class="section-title"><h3>Diário digital</h3></div><p v-for="(entry,i) in selected.history.slice(0,8)" :key="i" class="history">{{ entry }}</p></section></template></template>
      <template v-else-if="tab === 'evolucao'"><section class="panel" v-if="selectedTemplate && selected.partner"><span class="eyebrow">SUA LINHA</span><h2>{{ selectedTemplate.name }}</h2><p>Linhas BEM e DIM se encontram quando têm a mesma forma e estágio. Cada caminho conserva seus requisitos. O tempo começa ao nascer ou evoluir; treinos contam como troféus.</p><div class="evolutions"><article v-for="e in templateEvolutions" :key="e.key"><img class="evolution-silhouette" :src="'https://dim.digitallink.games' + e.target.previewUrl" alt="Silhueta de uma evolução desconhecida"><div><strong>???</strong><small v-if="e.crossed" class="line-change">TROCA DE LINHA: {{ selectedTemplate.type }} · {{ selectedTemplate.name }} → {{ e.sourceType }} · {{ e.sourceName }}</small><small v-else>Linha atual · {{ e.sourceType }} · {{ e.sourceName }}</small><ul class="requirements"><li v-for="item in evolutionProgress(game, e, now).items" :key="item.label" :class="{met: item.met}">{{ item.met ? '✓' : '○' }} {{ item.label }}: {{ item.current }} / {{ item.required }} {{ item.unit }}</li><li v-if="e.adventureLevel !== 65535" :class="{met: selected.adventureLevel >= e.adventureLevel}">{{ selected.adventureLevel >= e.adventureLevel ? '✓' : '○' }} Área {{ e.adventureLevel }} · concluída: {{ selected.adventureLevel < 0 ? 'nenhuma' : selected.adventureLevel }}</li></ul></div><div class="evo-actions"><button :disabled="!evolutionProgress(game, e, now).ready" @click="evolveTemplate(e)">Evoluir</button></div></article></div><p v-if="!templateEvolutions.length">Nenhuma evolução adicional neste template.</p></section><section class="panel" v-if="selected.partner"><span class="eyebrow">SUA JORNADA</span><h2>Formas alcançadas</h2><ol class="form-tree" aria-label="Histórico de digievoluções"><li v-for="(form,index) in selected.forms" :key="index" :class="{ current: index === selected.forms.length - 1 }"><span class="form-node" aria-hidden="true"></span><div><strong>{{ form.name }}</strong><small>{{ formLineName(form.templateId) || 'Linha anterior não registrada' }}<template v-if="index === selected.forms.length - 1"> · atual</template></small></div></li></ol></section><section class="panel" v-if="!selectedTemplate && selected.partner"><span class="eyebrow">CAMINHOS DESCONHECIDOS</span><h2>Próximas evoluções</h2><p>Descubra a forma do seu parceiro ao evoluir. Cada caminho exige 500 VP e 3 batalhas.</p><p v-if="loading">Carregando caminhos…</p><p v-else-if="error" class="notice">{{ error }}</p><div v-else class="evolutions"><article v-for="e in choices" :key="e.id"><img class="evolution-silhouette" :src="e.image" alt="Silhueta de uma evolução desconhecida"><div><strong>???</strong></div><div class="evo-actions"><button :disabled="!canEvolve" @click="evolve(e)">Evoluir</button></div></article></div><p v-if="!loading && !error && !choices.length">Nenhuma próxima evolução encontrada.</p></section><section class="panel" v-if="!selected.partner"><p>Choque seu ovo para descobrir os caminhos de evolução.</p></section></template>
      <template v-else><section class="panel"><span class="eyebrow">HEALTH CONNECT</span><h2>Seu movimento tem poder</h2><p>Conecte o Health Connect para ler os passos e as calorias ativas de hoje. O progresso é calculado no aparelho; nenhum dado de saúde é enviado pelo app para um servidor próprio.</p><div class="health-grid"><div><small>PASSOS HOJE</small><strong>{{ game.steps === null ? '—' : Math.round(game.steps).toLocaleString('pt-BR') }}</strong></div><div><small>CALORIAS ATIVAS</small><strong>{{ game.calories === null ? '—' : Math.round(game.calories).toLocaleString('pt-BR') }} <em v-if="game.calories !== null">kcal</em></strong></div></div><button class="primary" :disabled="syncing" @click="sync">{{ syncing ? 'SINCRONIZANDO…' : 'CONECTAR E SINCRONIZAR' }}</button><p class="muted">{{ game.updated ? 'Última sincronização: ' + new Date(game.updated).toLocaleString('pt-BR') : 'Ainda não sincronizado.' }} A disponibilidade depende do Mi Fitness e das permissões. Sem dados, exibimos —.</p><ol><li>Sincronize a Mi Band com o Mi Fitness.</li><li>Conecte o Mi Fitness ao Health Connect e permita compartilhar passos e calorias ativas.</li><li>Toque no botão acima e autorize a leitura no Android.</li></ol><p class="muted" v-if="syncSources">Última leitura · passos: {{ syncSources.steps === 'selected' ? 'pulseira (Better Mi Fitness Sync)' : syncSources.steps === 'combined' ? 'Health Connect (fontes combinadas)' : 'indisponível' }} · calorias: {{ syncSources.calories === 'selected' ? 'pulseira (Better Mi Fitness Sync)' : syncSources.calories === 'combined' ? 'Health Connect (fontes combinadas)' : 'indisponível' }}.</p><p class="muted">A sincronização acontece ao tocar no botão. O jogo não lê dados em segundo plano.</p></section><VisualSettings />
        <section class="panel">
          <h3>Fontes de atividade</h3>
          <p class="muted">A lista mostra as fontes de até 100 registros de hoje por tipo de atividade no Health Connect. O Mi Fitness pode ter permissão para gravar dados e ainda assim ficar fora da amostra. Confira as permissões do Mi Fitness no Health Connect.</p>
          <p class="muted">Quando há dados do Better Mi Fitness Sync, usamos essa fonte; caso contrário, usamos as prioridades do Health Connect.</p>
          <button type="button" class="secondary-battle" :disabled="readingSources" @click="inspectActivitySources">{{ readingSources ? 'CONSULTANDO…' : 'CONSULTAR FONTES' }}</button>
          <div aria-live="polite">
            <p v-if="sourceError" class="notice">{{ sourceError }}</p>
            <div v-for="result in activitySources" :key="result.dataType">
              <h4>{{ result.dataType === 'steps' ? 'Passos' : 'Calorias ativas' }}</h4>
              <p v-if="result.status === 'denied'" class="muted">Autorize a leitura ao sincronizar.</p>
              <p v-else-if="result.status === 'failed'" class="muted">Não foi possível consultar esta fonte de dados.</p>
              <template v-else-if="result.status === 'read'">
                <ul v-if="result.sources.length">
                  <li v-for="source in result.sources" :key="JSON.stringify([source.name, source.detail])" style="overflow-wrap: anywhere">
                    {{ source.name }}
                    <small v-if="source.detail"> · {{ source.detail }}</small>
                  </li>
                </ul>
                <p v-else class="muted">Nenhum registro de hoje encontrado na consulta.</p>
              </template>
            </div>
          </div>
        </section>
      </template>
    </main>
    <nav v-if="!battling" aria-label="Navegação principal"><button v-for="item in ([['parceiro','partner','PARCEIRO'],['aventura','adventure','AVENTURA'],['evolucao','evolution','EVOLUÇÃO'],['saude','health','ATIVIDADE']] as const)" :key="item[0]" :disabled="hatching" :class="{active: tab === item[0]}" :aria-current="tab === item[0] ? 'page' : undefined" @click="tab = item[0]; message = ''"><AppIcon :name="item[1]" :size="21" /><span>{{ item[2] }}</span></button></nav>
  </div>
</template>
