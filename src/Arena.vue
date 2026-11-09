<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ sprite: string; power: number; stamina: number }>()
const emit = defineEmits<{ finish: [won: boolean] }>()

type Position = { x: number; y: number }
type Enemy = Position & { id: number; hp: number; maxHp: number }
type Hit = Position & { expires: number }
type Direction = 'up' | 'left' | 'down' | 'right'
type PointerInput = { direction: Direction; startedAt: number }

const directions = [
  { id: 'up', label: 'Mover para cima', symbol: '▲' },
  { id: 'left', label: 'Mover para a esquerda', symbol: '◀' },
  { id: 'down', label: 'Mover para baixo', symbol: '▼' },
  { id: 'right', label: 'Mover para a direita', symbol: '▶' },
] as const
const keyDirections = new Map<string, Direction>([
  ['arrowup', 'up'], ['w', 'up'],
  ['arrowleft', 'left'], ['a', 'left'],
  ['arrowdown', 'down'], ['s', 'down'],
  ['arrowright', 'right'], ['d', 'right'],
])
const stepMs = 20
const duration = 45
const maxHp = 100 + props.stamina * 5
const player = ref({ x: 50, y: 74, hp: maxHp })
const enemies = ref<Enemy[]>([])
const hit = ref<Hit>()
const time = ref(duration)
const defeated = ref(0)
const paused = ref(false)
const arena = ref<HTMLElement>()
const resumeButton = ref<HTMLButtonElement>()
const playerSpriteFailed = ref(false)
const enemySpriteFailed = ref(false)
const enemySprite = 'https://dim.digitallink.games/api/sprites/Qie1bpWEWBvBmrE3dvFV/preview'
const keys = ref(new Map<string, Direction>())
const pointers = ref(new Map<number, PointerInput>())
const heldDirections = computed(() => new Set([
  ...keys.value.values(),
  ...Array.from(pointers.value.values(), input => input.direction),
]))
let playing = true
let frame = 0
let nextId = 1
let animationId = 0
let previousTime = 0
let accumulatedTime = 0

watch(() => props.sprite, () => { playerSpriteFailed.value = false })

function keydown(event: KeyboardEvent) {
  if (!playing || paused.value || event.altKey || event.ctrlKey || event.metaKey ||
    (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]'))) return
  const key = event.key.toLowerCase()
  const direction = keyDirections.get(key)
  if (direction) {
    event.preventDefault()
    if (!event.repeat) keys.value.set(key, direction)
  }
}

function keyup(event: KeyboardEvent) {
  keys.value.delete(event.key.toLowerCase())
}

function holdDirection(event: PointerEvent, direction: Direction) {
  if (event.button !== 0 || paused.value || !playing) return
  if (!(event.currentTarget instanceof HTMLButtonElement)) return
  event.currentTarget.setPointerCapture(event.pointerId)
  pointers.value.set(event.pointerId, { direction, startedAt: frame })
}

function releaseDirection(event: PointerEvent) {
  const input = pointers.value.get(event.pointerId)
  pointers.value.delete(event.pointerId)
  if (event.type === 'pointerup' && input?.startedAt === frame) nudge(input.direction, .24)
}

function movePlayer(dx: number, dy: number, distance: number) {
  const length = Math.hypot(dx, dy) || 1
  player.value.x = Math.max(4, Math.min(96, player.value.x + dx / length * distance))
  player.value.y = Math.max(5, Math.min(95, player.value.y + dy / length * distance))
}

function nudge(direction: Direction, distance: number) {
  const dx = Number(direction === 'right') - Number(direction === 'left')
  const dy = Number(direction === 'down') - Number(direction === 'up')
  movePlayer(dx, dy, distance)
}

function tapDirection(event: MouseEvent, direction: Direction) {
  // Native keyboard and assistive activations emit a click without a pointer.
  if (event.detail === 0 && !paused.value && playing) nudge(direction, 1.2)
}

function stopLoop() {
  cancelAnimationFrame(animationId)
  keys.value.clear()
  pointers.value.clear()
}

function startLoop() {
  accumulatedTime = 0
  previousTime = performance.now()
  animationId = requestAnimationFrame(animate)
}

function pause() {
  if (!playing || paused.value) return
  paused.value = true
  stopLoop()
}

function resume() {
  if (!playing || !paused.value || document.hidden) return
  paused.value = false
  startLoop()
  arena.value?.focus({ preventScroll: true })
}

function visibilityChanged() {
  if (document.hidden) pause()
}

function finish(won: boolean) {
  if (!playing) return
  playing = false
  stopLoop()
  emit('finish', won)
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4)
  const edgePosition = Math.random() * 100
  const hp = 3
  enemies.value.push({
    id: nextId++,
    x: side === 0 ? 0 : side === 1 ? 100 : edgePosition,
    y: side === 2 ? 0 : side === 3 ? 100 : edgePosition,
    hp,
    maxHp: hp,
  })
}

function tick() {
  frame++
  const held = heldDirections.value
  const dx = Number(held.has('right')) - Number(held.has('left'))
  const dy = Number(held.has('down')) - Number(held.has('up'))
  if (dx || dy) movePlayer(dx, dy, .24)

  if (frame % 125 === 5 && enemies.value.length < 16) spawnEnemy()
  let nearest: Enemy | undefined
  let nearestDistance = Infinity

  for (const enemy of enemies.value) {
    const ex = player.value.x - enemy.x
    const ey = player.value.y - enemy.y
    const distance = Math.hypot(ex, ey)
    const step = Math.min(distance, .058) / (distance || 1)
    enemy.x += ex * step
    enemy.y += ey * step
    if (distance < 7 && frame % 60 === 0) player.value.hp = Math.max(0, player.value.hp - 5)
    if (distance < nearestDistance) {
      nearest = enemy
      nearestDistance = distance
    }
  }

  if (hit.value?.expires === frame) hit.value = undefined
  if (frame % 40 === 0 && nearest) {
    nearest.hp -= 1 + props.power * .1
    hit.value = { x: nearest.x, y: nearest.y, expires: frame + 8 }
    if (nearest.hp <= 0) {
      const index = enemies.value.indexOf(nearest)
      enemies.value.splice(index, 1)
      defeated.value++
    }
  }

  if (frame % 50 === 0) time.value--
  if (player.value.hp <= 0) finish(false)
  else if (time.value <= 0) finish(true)
}

function animate(timestamp: number) {
  if (!playing || paused.value) return
  // Keep combat and the countdown in sync after a long render stall.
  accumulatedTime += Math.max(0, Math.min(timestamp - previousTime, 100))
  previousTime = timestamp
  while (playing && accumulatedTime >= stepMs) {
    accumulatedTime -= stepMs
    tick()
  }
  if (playing) animationId = requestAnimationFrame(animate)
}

watch(paused, value => {
  if (value && !document.hidden) resumeButton.value?.focus({ preventScroll: true })
}, { flush: 'post' })

onMounted(() => {
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  window.addEventListener('blur', pause)
  document.addEventListener('visibilitychange', visibilityChanged)
  arena.value?.focus({ preventScroll: true })
  if (document.hidden) pause()
  else startLoop()
})

onUnmounted(() => {
  playing = false
  stopLoop()
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('keyup', keyup)
  window.removeEventListener('blur', pause)
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<template>
  <section ref="arena" class="arena" tabindex="-1" aria-label="Arena Survivor">
    <div class="arena-header">
      <span>ARENA SURVIVOR</span>
      <strong>{{ time }}s</strong>
      <span>{{ defeated }} DERROTADOS</span>
    </div>
    <div class="arena-field">
      <div v-for="enemy in enemies" :key="enemy.id" class="enemy" :style="{ left: enemy.x + '%', top: enemy.y + '%' }">
        <img v-if="!enemySpriteFailed" :src="enemySprite" alt="" draggable="false" @error="enemySpriteFailed = true">
        <span v-else class="unit-marker enemy-marker" aria-hidden="true"></span>
        <div class="enemy-hp"><span :style="{ width: 100 * enemy.hp / enemy.maxHp + '%' }"></span></div>
      </div>
      <div v-if="hit" class="hit" :style="{ left: hit.x + '%', top: hit.y + '%' }"></div>
      <div class="fighter" :style="{ left: player.x + '%', top: player.y + '%' }">
        <img v-if="sprite && !playerSpriteFailed" :src="sprite" alt="Parceiro" draggable="false" @error="playerSpriteFailed = true">
        <span v-else class="unit-marker" role="img" aria-label="Parceiro"></span>
      </div>
      <div v-if="paused" class="pause-screen">
        <strong>Batalha pausada</strong>
        <button ref="resumeButton" type="button" class="arena-action" @click="resume">Retomar batalha</button>
      </div>
    </div>
    <div class="arena-health">
      <span>HP</span>
      <div role="progressbar" aria-label="Vida do parceiro" :aria-valuenow="player.hp" :aria-valuemax="maxHp">
        <span :style="{ width: 100 * player.hp / maxHp + '%' }"></span>
      </div>
      <strong>{{ player.hp }}/{{ maxHp }}</strong>
    </div>
    <p>Sobreviva por {{ duration }} segundos. Use as setas, WASD ou os botões para desviar. Os ataques são automáticos.</p>
    <div class="dpad" role="group" aria-label="Direcionais">
      <button
        v-for="direction in directions"
        :key="direction.id"
        type="button"
        :class="[direction.id, { held: heldDirections.has(direction.id) }]"
        :aria-label="direction.label"
        :disabled="paused"
        @pointerdown.prevent="holdDirection($event, direction.id)"
        @pointerup="releaseDirection"
        @pointercancel="releaseDirection"
        @lostpointercapture="releaseDirection"
        @click="tapDirection($event, direction.id)"
        @contextmenu.prevent
      >{{ direction.symbol }}</button>
    </div>
    <div class="arena-actions">
      <button type="button" class="arena-action" :disabled="paused" @click="pause">Pausar</button>
      <button type="button" class="arena-action" @click="finish(false)">Sair da batalha</button>
    </div>
  </section>
</template>

<style scoped>
.arena-field { height: clamp(210px, 40svh, 360px); }
.dpad button { height: 48px; user-select: none; }
.dpad button.held { background: #527061; color: #fff; }
.arena-actions { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
.arena-action { min-height: 44px; padding: 6px 12px; border: 1px solid #527061; border-radius: 8px; background: #263a3b; color: #d5efbb; }
.arena button:disabled { opacity: .5; }
.pause-screen { position: absolute; inset: 0; display: grid; place-content: center; gap: 10px; text-align: center; background: #111b25e6; }
.unit-marker { display: block; width: 28px; height: 28px; margin: 10px auto; border: 2px solid #fff; border-radius: 50%; background: #c5f76a; }
.enemy-marker { background: #ff877d; }
</style>
