<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import sprites from './sprites.json'
import { newGame, applyHealth, evolutionProgress, type Game } from './game'
import { readActivitySources, syncHealth, type ActivitySourceResult } from './health'
import Arena from './Arena.vue'
import templates from './templates.json'

type Evolution = { id: number; digimon: string; image: string; condition: string }
type Digi = { name: string; images: { href: string }[]; levels: { level: string }[]; nextEvolutions: Evolution[]; priorEvolutions: Evolution[] }
const key = 'digital-companion-be-v1'
function load(): Game { try { const saved = localStorage.getItem(key); return saved ? { ...newGame(), ...JSON.parse(saved) } : newGame() } catch { return newGame() } }
const game = ref<Game>(load())
watch(game, value => localStorage.setItem(key, JSON.stringify(value)), { deep: true })
const tab = ref<'parceiro'|'aventura'|'evolucao'|'saude'>('parceiro')
const battling = ref(false)
const areaBattle = ref(false)
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => { clock = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (clock) clearInterval(clock) })
const digi = ref<Digi | null>(null); const loading = ref(false); const error = ref(''); const syncing = ref(false); const message = ref(''); const query = ref(''); const viewed = ref('')
const readingSources = ref(false)
const activitySources = ref<ActivitySourceResult[]>([])
const sourceError = ref('')
const currentSprite = computed(() => sprites.find(s => s.name.toLowerCase() === game.value.partner.toLowerCase()))
const selectedTemplate = computed(() => templates.find(t => t.id === game.value.templateId))
const selectedCharacter = computed(() => selectedTemplate.value?.characters.find(c => c.index === game.value.characterIndex))
const spriteUrl = computed(() => selectedCharacter.value ? `https://dim.digitallink.games${selectedCharacter.value.previewUrl}` : currentSprite.value ? `https://dim.digitallink.games${currentSprite.value.previewUrl}` : digi.value?.name === game.value.partner ? digi.value.images[0]?.href : '')
const templateEvolutions = computed(() => (selectedTemplate.value?.evolutions || []).filter(e => e.from === game.value.characterIndex).map(e => ({ ...e, target: selectedTemplate.value?.characters.find(c => c.index === e.to) })).filter(e => e.target))
const choices = computed(() => (digi.value?.nextEvolutions || []).filter(x => x.digimon.toLowerCase().includes(query.value.toLowerCase())))
const progress = computed(() => Math.min(100, Math.floor((game.value.distance % 1000) / 10)))
const canEvolve = computed(() => digi.value?.name.toLowerCase() === game.value.partner.toLowerCase())
let browseRequest = 0
async function browse(name: string) { if (!name) return; const request = ++browseRequest; loading.value = true; error.value = ''; query.value = ''; viewed.value = name; try { const response = await fetch(`https://digi-api.com/api/v1/digimon/${encodeURIComponent(name)}`); if (!response.ok) throw new Error(); const result = await response.json() as Digi; if (request === browseRequest) digi.value = result } catch { if (request === browseRequest) { digi.value = null; error.value = 'Não foi possível carregar as evoluções. Verifique sua conexão e tente novamente.' } } finally { if (request === browseRequest) loading.value = false } }
onMounted(() => { if (game.value.partner) void browse(game.value.partner) })
function drawEgg() { const pool = templates.flatMap(t => t.characters.filter(c => c.stage === 0 && t.evolutions.some(e => e.from === c.index && e.adventureLevel === 65535)).map(c => ({t,c}))); if (!pool.length) { message.value = 'Nenhum ovo disponível.'; return } const pick = pool[Math.floor(Math.random()*pool.length)]!; game.value.templateId = pick.t.id; game.value.characterIndex = pick.c.index; game.value.egg = true; message.value = 'Um ovo misterioso chegou! Toque em chocar para descobrir seu parceiro.' }
function hatch() { if (!selectedCharacter.value) return; game.value.partner = selectedCharacter.value.name; game.value.egg = false; game.value.born = Date.now(); game.value.history.unshift(`${game.value.partner} nasceu do ovo misterioso.`); message.value = `${game.value.partner} nasceu!`; void browse(game.value.partner) }
function evolveTemplate(e: typeof templateEvolutions.value[number]) { if (!e.target || !evolutionProgress(game.value, e, Date.now()).ready) { message.value = 'Confira os requisitos pendentes desta evolução.'; return } const old=game.value.partner; game.value.characterIndex=e.to; game.value.partner=e.target.name; game.value.born=Date.now(); game.value.power=0; game.value.stamina=0; game.value.battles=0; game.value.wins=0; game.value.history.unshift(`${old} digievoluiu para ${e.target.name}!`); message.value = `${old} digievoluiu para ${e.target.name}!`; void browse(e.target.name) }
async function sync() { syncing.value = true; message.value = ''; try { const result = await syncHealth(); game.value = applyHealth(game.value, result.day, result.steps, result.calories); message.value = result.failed.length ? 'Sincronização parcial: alguns dados não puderam ser consultados e aparecem como indisponíveis.' : result.denied.length ? 'Sincronizado. Algumas permissões foram negadas; dados não autorizados aparecem como indisponíveis.' : 'Sincronização concluída. Dados ausentes continuam indisponíveis.' } catch (e) { message.value = e instanceof Error ? e.message : 'Não foi possível sincronizar.' } finally { syncing.value = false } }
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
function train(kind: 'power'|'stamina') { if (game.value.vital < 25) { message.value = 'São necessários 25 pontos vitais para treinar.'; return } game.value.vital -= 25; game.value[kind]++; game.value.history.unshift(`Treino de ${kind === 'power' ? 'força' : 'resistência'} concluído.`); message.value = 'Treino concluído!' }
function battle(area = false) { if (area && game.value.distance < (game.value.adventureLevel + 2) * 1000) { message.value = 'Acumule passos suficientes para enfrentar a próxima área.'; return } if (game.value.vital < 50) { message.value = 'São necessários 50 pontos vitais para batalhar.'; return } game.value.vital -= 50; game.value.battles++; areaBattle.value = area; message.value = ''; battling.value = true }
function battleFinished(won: boolean) { battling.value = false; if (won) game.value.wins++; if (won && areaBattle.value) { game.value.adventureLevel++; game.value.history.unshift(`Área ${game.value.adventureLevel} concluída na expedição.`); message.value = `Vitória! Área ${game.value.adventureLevel} concluída.` } else { game.value.history.unshift(won ? 'Vitória na arena digital.' : 'Batalha encerrada na arena digital.'); message.value = won ? 'Vitória! Você sobreviveu à arena.' : 'A batalha terminou. Tente novamente!' } areaBattle.value = false }
function evolve(e: Evolution) { if (!canEvolve.value || game.value.vital < 500 || game.value.battles < 3) { message.value = 'Para digievoluir: consulte seu parceiro atual, acumule 500 vitais e participe de 3 batalhas.'; return } const old = game.value.partner; game.value.partner = e.digimon; game.value.vital -= 500; game.value.born = Date.now(); game.value.history.unshift(`${old} digievoluiu para ${e.digimon}!`); message.value = `${old} digievoluiu para ${e.digimon}!`; void browse(e.digimon); tab.value = 'parceiro' }
</script>

<template>
  <div class="app-shell">
    <header class="topbar"><div class="brand-mark">D<span>·</span></div><div><small>DIGITAL COMPANION</small><strong>BE <i>PROJECT</i></strong></div><span class="badge">PROTÓTIPO</span></header>
    <main>
      <section class="heading"><div><span class="eyebrow">SEU MUNDO DIGITAL</span><h1>{{ tab === 'parceiro' ? 'Seu parceiro' : tab === 'aventura' ? 'Aventura' : tab === 'evolucao' ? 'Digievolução' : 'Minha atividade' }}</h1></div><div class="signal">● DIGITAL LIFE</div></section>
      <p v-if="message" class="notice" role="status">{{ message }}</p>
      <template v-if="tab === 'parceiro' && !game.partner"><section class="panel egg-panel"><span class="eyebrow">UMA NOVA AVENTURA</span><h2>{{ game.egg ? "Um ovo misterioso!" : "Seu primeiro parceiro" }}</h2><div class="egg-symbol">?</div><p>{{ game.egg ? "Um template e um bebê foram sorteados. Choque o ovo para descobrir seu parceiro e sua linha." : "Sorteie um ovo para começar uma jornada com um dos 15 templates BEM do Digital Link." }}</p><button class="primary" v-if="!game.egg" @click="drawEgg">SORTEAR OVO</button><button class="primary" v-else @click="hatch">CHOCAR OVO</button></section></template><template v-else-if="tab === 'parceiro'">
        <section class="device"><div class="device-top"><span>PARTNER / 01</span><span>● DIGITAL LIFE</span></div><div class="screen"><div class="screen-grid"></div><div class="screen-meta"><span>VITAL BRACELET</span><span>BE</span></div><div class="sprite-wrap"><img v-if="spriteUrl" :src="spriteUrl" :alt="game.partner" @error="($event.target as HTMLImageElement).style.display = 'none'"><span v-else>SPRITE INDISPONÍVEL</span></div><div class="screen-bottom"><span>PARTNER ONLINE</span><span>◆ ◆ ◆</span></div></div><div class="partner-info"><div><small>SEU PARCEIRO</small><h2>{{ game.partner }}</h2><p>{{ digi?.name === game.partner ? digi.levels.map(x => x.level).join(' / ') : 'Digimon' }}</p></div><div class="vital"><small>VITAL POINTS</small><strong>{{ game.vital.toLocaleString('pt-BR') }}</strong><span>VP</span></div></div><p class="credit" v-if="selectedTemplate">Template e sprite: {{ selectedTemplate.name }} · Digital Link</p><p class="credit" v-else-if="currentSprite">Sprite: {{ currentSprite.author }} · Digital Link</p><p class="credit" v-else>Imagem Digi-API quando disponível</p></section>
        <div class="stats"><div><small>FORÇA</small><strong>{{ game.power }}</strong><span>AP</span></div><div><small>RESISTÊNCIA</small><strong>{{ game.stamina }}</strong><span>HP</span></div><div><small>VITÓRIAS</small><strong>{{ game.wins }}</strong><span>{{ game.battles }} batalhas</span></div></div>
        <section class="panel"><div class="section-title"><div><span class="eyebrow">MAIS FORTE A CADA DIA</span><h3>Treinar parceiro</h3></div><span class="pill">25 VP</span></div><div class="actions"><button @click="train('power')"><b>01</b><span>Treino de força<small>Aumenta AP</small></span><strong>↗</strong></button><button @click="train('stamina')"><b>02</b><span>Treino de resistência<small>Aumenta HP</small></span><strong>↗</strong></button></div></section>
      </template>
      <template v-else-if="tab === 'aventura' && !game.partner"><section class="panel"><p>Choque seu ovo antes de começar a aventura.</p></section></template><template v-else-if="tab === 'aventura'"><Arena v-if="battling" :sprite="spriteUrl || ''" :power="game.power" :stamina="game.stamina" @finish="battleFinished" /><template v-else><section class="panel adventure"><span class="eyebrow">EXPLORE O MUNDO DIGITAL</span><h2>Expedição ativa</h2><p>Seus passos sincronizados alimentam a jornada. A cada 1.000 passos você completa um trecho.</p><div class="progress-head"><span>PRÓXIMO TRECHO</span><strong>{{ game.distance % 1000 }} / 1.000</strong></div><div class="progress" role="progressbar" aria-label="Progresso do próximo trecho" :aria-valuenow="game.distance % 1000" aria-valuemin="0" aria-valuemax="1000"><span :style="{width: progress + '%'}"></span></div><p>{{ Math.floor(game.distance / 1000) }} trechos concluídos · {{ game.distance.toLocaleString('pt-BR') }} passos acumulados</p><p>Próxima área: {{ game.adventureLevel + 1 }} · {{ Math.min(game.distance, (game.adventureLevel + 2) * 1000).toLocaleString('pt-BR') }} / {{ ((game.adventureLevel + 2) * 1000).toLocaleString('pt-BR') }} passos acumulados</p><p class="muted">Cada área exige mais 1.000 passos acumulados e uma vitória. As áreas são uma regra deste protótipo.</p><button class="primary" :disabled="game.distance < (game.adventureLevel + 2) * 1000" @click="battle(true)">DESAFIAR ÁREA {{ game.adventureLevel + 1 }} · 50 VP</button><button class="secondary-battle" @click="battle(false)">BATALHA LIVRE · 50 VP</button><p class="muted">Sobreviva, desvie e ataque automaticamente.</p></section><section class="panel"><div class="section-title"><h3>Diário digital</h3></div><p v-for="(entry,i) in game.history.slice(0,8)" :key="i" class="history">{{ entry }}</p></section></template></template>
      <template v-else-if="tab === 'evolucao'"><section class="panel" v-if="selectedTemplate && game.partner"><span class="eyebrow">SUA LINHA BEM</span><h2>{{ selectedTemplate.name }}</h2><p>Requisitos importados do template. O tempo começa ao nascer ou evoluir; treinos contam como troféus. Áreas são liberadas na expedição ao acumular passos e vencer seus desafios.</p><div class="evolutions"><article v-for="e in templateEvolutions" :key="e.to"><img class="evolution-silhouette" :src="'https://dim.digitallink.games' + e.target!.previewUrl" alt="Silhueta de uma evolução desconhecida"><div><strong>???</strong><ul class="requirements"><li v-for="item in evolutionProgress(game, e, now).items" :key="item.label" :class="{met: item.met}">{{ item.met ? '✓' : '○' }} {{ item.label }}: {{ item.current }} / {{ item.required }} {{ item.unit }}</li><li v-if="e.adventureLevel !== 65535" :class="{met: game.adventureLevel >= e.adventureLevel}">{{ game.adventureLevel >= e.adventureLevel ? '✓' : '○' }} Área {{ e.adventureLevel }} · concluída: {{ game.adventureLevel < 0 ? 'nenhuma' : game.adventureLevel }}</li></ul></div><div class="evo-actions"><button :disabled="!evolutionProgress(game, e, now).ready" @click="evolveTemplate(e)">Evoluir</button></div></article></div><p v-if="!templateEvolutions.length">Nenhuma evolução adicional neste template.</p></section><section class="panel" v-if="!selectedTemplate && game.partner"><span class="eyebrow">CAMINHOS DESCONHECIDOS</span><h2>Próximas evoluções</h2><p>Descubra a forma do seu parceiro ao evoluir. Cada caminho exige 500 VP e 3 batalhas.</p><p v-if="loading">Carregando caminhos…</p><p v-else-if="error" class="notice">{{ error }}</p><div v-else class="evolutions"><article v-for="e in choices" :key="e.id"><img class="evolution-silhouette" :src="e.image" alt="Silhueta de uma evolução desconhecida"><div><strong>???</strong></div><div class="evo-actions"><button :disabled="!canEvolve" @click="evolve(e)">Evoluir</button></div></article></div><p v-if="!loading && !error && !choices.length">Nenhuma próxima evolução encontrada.</p></section><section class="panel" v-if="!game.partner"><p>Choque seu ovo para descobrir os caminhos de evolução.</p></section></template>
      <template v-else><section class="panel"><span class="eyebrow">HEALTH CONNECT</span><h2>Seu movimento tem poder</h2><p>Conecte o Health Connect para ler os passos e as calorias ativas de hoje. O progresso é calculado no aparelho; nenhum dado de saúde é enviado pelo app para um servidor próprio.</p><div class="health-grid"><div><small>PASSOS HOJE</small><strong>{{ game.steps === null ? '—' : Math.round(game.steps).toLocaleString('pt-BR') }}</strong></div><div><small>CALORIAS ATIVAS</small><strong>{{ game.calories === null ? '—' : Math.round(game.calories).toLocaleString('pt-BR') }} <em v-if="game.calories !== null">kcal</em></strong></div></div><button class="primary" :disabled="syncing" @click="sync">{{ syncing ? 'SINCRONIZANDO…' : 'CONECTAR E SINCRONIZAR' }}</button><p class="muted">{{ game.updated ? 'Última sincronização: ' + new Date(game.updated).toLocaleString('pt-BR') : 'Ainda não sincronizado.' }} A disponibilidade depende do Mi Fitness e das permissões. Sem dados, exibimos —.</p><ol><li>Sincronize a Mi Band com o Mi Fitness.</li><li>Conecte o Mi Fitness ao Health Connect e permita compartilhar passos e calorias ativas.</li><li>Toque no botão acima e autorize a leitura no Android.</li></ol><p class="muted">A sincronização acontece ao tocar no botão. O jogo não lê dados em segundo plano.</p></section>
        <section class="panel">
          <h3>Fontes de atividade</h3>
          <p class="muted">Consulte uma amostra de até 100 registros de hoje por tipo no Health Connect. A lista pode ser parcial. Os totais seguem as prioridades de fontes do Health Connect.</p>
          <button type="button" class="secondary-battle" :disabled="readingSources" @click="inspectActivitySources">{{ readingSources ? 'CONSULTANDO…' : 'CONSULTAR FONTES' }}</button>
          <div aria-live="polite">
            <p v-if="sourceError" class="notice">{{ sourceError }}</p>
            <div v-for="result in activitySources" :key="result.dataType">
              <h4>{{ result.dataType === 'steps' ? 'Passos' : 'Calorias ativas' }}</h4>
              <p v-if="result.status === 'denied'" class="muted">Autorize a leitura ao sincronizar.</p>
              <p v-else-if="result.status === 'failed'" class="muted">Não foi possível consultar esta fonte de dados.</p>
              <template v-else-if="result.status === 'read'">
                <ul v-if="result.sources.length">
                  <li v-for="source in result.sources" :key="JSON.stringify([source.name, source.id])" style="overflow-wrap: anywhere">
                    {{ source.name || source.id || 'Origem não identificada' }}
                    <small v-if="source.name && source.id && source.name !== source.id">({{ source.id }})</small>
                  </li>
                </ul>
                <p v-else class="muted">Nenhum registro de hoje encontrado na consulta.</p>
              </template>
            </div>
          </div>
        </section>
      </template>
    </main>
    <nav v-if="!battling" aria-label="Navegação principal"><button v-for="item in ([['parceiro','01','PARCEIRO'],['aventura','02','AVENTURA'],['evolucao','03','EVOLUÇÃO'],['saude','04','ATIVIDADE']] as const)" :key="item[0]" :class="{active: tab === item[0]}" :aria-current="tab === item[0] ? 'page' : undefined" @click="tab = item[0]; message = ''"><b>{{ item[1] }}</b><span>{{ item[2] }}</span></button></nav>
  </div>
</template>
