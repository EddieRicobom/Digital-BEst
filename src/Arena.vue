<script lang="ts">
export interface ArenaMember {
  id: string
  name: string
  sprite: string
  sheet?: string
  baby?: boolean
  stage: number
  templateId?: string
  power: number
  stamina: number
  baseAttack?: number
  baseHp?: number
  baseBp?: number
}

export interface ArenaBattleResult {
  won: boolean
  participantIds: string[]
  activeMemberId: string
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AnimatedSprite from './AnimatedSprite.vue'
import { arenaMoves } from './arenaMoves'
import { useSpriteSheet } from './sprite-effects'

const props = defineProps<{
  team?: readonly ArenaMember[]
  initialMemberId?: string
  adventure?: boolean
  areaLevel?: number
  sprite?: string
  sheet?: string
  baby?: boolean
  partner?: string
  stage?: number
  templateId?: string
  power?: number
  stamina?: number
}>()
const emit = defineEmits<{ finish: [result: boolean | ArenaBattleResult] }>()

type Position = { x: number; y: number }
type EnemyKind = 'pursuer' | 'shooter' | 'charger' | 'boss'
type Enemy = Position & { id: number; hp: number; maxHp: number; kind: EnemyKind; cooldown: number; windup: number; radialAttack: boolean; charge: number; vx: number; vy: number }
type Hit = Position & { expires: number; enemyId: number }
type Projectile = Position & { id: number; vx: number; vy: number; remaining: number; damage: number; color: string; hostile: boolean; piercing: boolean; hitIds: number[] }
type Effect = Position & { id: number; expires: number; radius: number; color: string; kind: 'burst' | 'slash'; angle: number }
type Direction = 'up' | 'left' | 'down' | 'right'

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
const teamKeys = ['4', '5', '6', '7']
const waves = [
  { count: 6, interval: 55 },
  { count: 9, interval: 39 },
  { count: 13, interval: 26 },
]
const guardians = [
  { name: 'Greymon Guardião', sheet: 'enemy-greymon.png', hp: 48, fan: 5, spacing: .22, radial: 12, cooldown: 138, rageCooldown: 95, color: '#ff667c' },
  { name: 'Canoweissmon', sheet: 'c8dacdf5b84f7f33/7.png', hp: 50, fan: 7, spacing: .24, radial: 10, cooldown: 155, rageCooldown: 110, color: '#ffb06f' },
  { name: 'Amphimon', sheet: '2704968a7410c870/14.png', hp: 52, fan: 3, spacing: .14, radial: 14, cooldown: 115, rageCooldown: 88, color: '#80e0ff' },
]
const upgrades = [
  { id: 'power', name: 'Sobrecarga', description: '+30% do dano base dos golpes' },
  { id: 'cadence', name: 'Recarga rápida', description: '−18% do tempo base entre golpes' },
  { id: 'range', name: 'Alcance ampliado', description: '+5 de alcance em todos os golpes' },
  { id: 'cannon', name: 'Canhão auxiliar', description: 'Acrescenta um disparo perfurante a cada golpe. Repetir aumenta o dano.' },
  { id: 'repair', name: 'Reparo de emergência', description: 'Recupera 35% do HP máximo dos Digimon vivos' },
] as const
type Upgrade = typeof upgrades[number]
const areaNumber = computed(() => {
  const level = props.areaLevel ?? 0
  return Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0
})
const areaDifficulty = computed(() => Math.min(12, areaNumber.value))
const guardian = computed(() => guardians[areaNumber.value % guardians.length]!)
const waveIndex = ref(0)
const wave = computed(() => waves.at(waveIndex.value))
const waveDefeated = ref(0)
let waveSpawned = 0
let nextSpawnFrame = 5
const upgradeChoices = ref<Upgrade[]>([])
const upgradeRanks = ref({ power: 0, cadence: 0, range: 0, cannon: 0 })
const upgradePanel = ref<HTMLElement>()

function fighterState(stamina: number, baseHp?: number) {
  const startingHp = baseHp && Number.isFinite(baseHp) && baseHp > 0 ? Math.min(225, Math.max(75, Math.round(baseHp / 30))) : 100
  const maxHp = startingHp + stamina * 5
  return { hp: maxHp, maxHp, selectedMove: 0, nextAttackFrame: 0 }
}
const roster = ref((props.team ?? []).slice(0, teamKeys.length).map(member => ({ ...member, ...fighterState(member.stamina, member.baseHp) })))
const activeIndex = ref(Math.max(0, roster.value.findIndex(member => member.id === props.initialMemberId)))
const activeMember = computed(() => roster.value.at(activeIndex.value))
const participantIds = new Set(activeMember.value ? [activeMember.value.id] : [])
const solo = ref(fighterState(props.stamina ?? 0))
const fighter = computed(() => activeMember.value ?? solo.value)
const teamAttackReadyFrame = computed(() => roster.value.reduce((readyFrame, member) => Math.max(readyFrame, member.nextAttackFrame), solo.value.nextAttackFrame))
const difficultyStage = activeMember.value?.stage
const player = ref({ x: 50, y: 74 })
const enemies = ref<Enemy[]>([])
const hit = ref<Hit>()
const projectiles = ref<Projectile[]>([])
const effects = ref<Effect[]>([])
const moves = computed(() => arenaMoves(activeMember.value?.name ?? props.partner ?? '', activeMember.value?.stage ?? props.stage ?? 2, activeMember.value ? activeMember.value.templateId : props.templateId))
const activeMove = computed(() => moves.value[fighter.value.selectedMove]!)
const attackRange = computed(() => activeMove.value.range + upgradeRanks.value.range * 5)
const distanceToTarget = ref(Infinity)
const targetInRange = computed(() => distanceToTarget.value <= attackRange.value)
const dodgeCooldown = ref(0)
const dodgeFrames = ref(0)
let facing = { x: 0, y: -1 }
let dodgeDirection = { x: 0, y: -1 }
let lastAttack = 0
const attacking = ref(false)
const time = ref(duration)
const defeated = ref(0)
const paused = ref(false)
const suspended = computed(() => paused.value || upgradeChoices.value.length > 0)
const boss = computed(() => props.adventure && !wave.value ? enemies.value.find(enemy => enemy.kind === 'boss') : undefined)
const arena = ref<HTMLElement>()
const field = ref<HTMLElement>()
const fieldAspect = ref(1)
function updateFieldAspect() { const rect = field.value?.getBoundingClientRect(); if (rect?.width && rect.height) fieldAspect.value = rect.width / rect.height }
const resumeButton = ref<HTMLButtonElement>()
const pursuerSheet = useSpriteSheet(() => `${import.meta.env.BASE_URL}assets/sprites/c8dacdf5b84f7f33/2.png`)
const shooterSheet = useSpriteSheet(() => `${import.meta.env.BASE_URL}assets/sprites/2704968a7410c870/2.png`)
const chargerSheet = useSpriteSheet(() => `${import.meta.env.BASE_URL}assets/sprites/enemy-greymon.png`)
const guardianSheet = useSpriteSheet(() => props.adventure ? `${import.meta.env.BASE_URL}assets/sprites/${guardian.value.sheet}` : '')
const enemySheets = computed(() => ({ pursuer: pursuerSheet.value, shooter: shooterSheet.value, charger: chargerSheet.value, boss: guardianSheet.value }))
const keys = ref(new Map<string, Direction>())
const joystick = ref({ x: 0, y: 0 })
const joystickElement = ref<HTMLElement>()
let joystickPointer: number | undefined
const heldDirections = computed(() => new Set(keys.value.values()))
const movement = computed(() => {
  const held = heldDirections.value
  const x = Number(held.has('right')) - Number(held.has('left')) + joystick.value.x
  const y = Number(held.has('down')) - Number(held.has('up')) + joystick.value.y
  const length = Math.hypot(x, y)
  return length > 1 ? { x: x / length, y: y / length } : { x, y }
})
const idleFrames = [0, 1], babyWalkFrames = [0, 2], babyAttackFrames = [0, 8], walkFrames = [2, 3], attackFrames = [0, 10]
const fighterFrames = computed(() => {
  const baby = activeMember.value ? activeMember.value.baby : props.baby
  if (attacking.value) return baby ? babyAttackFrames : attackFrames
  if (Math.hypot(movement.value.x, movement.value.y) > 0) return baby ? babyWalkFrames : walkFrames
  return idleFrames
})
let playing = true
let frame = 0
let nextId = 1
let spawnedEnemies = 0
let animationId = 0
let previousTime = 0
let accumulatedTime = 0


function keydown(event: KeyboardEvent) {
  if (!playing || suspended.value || event.altKey || event.ctrlKey || event.metaKey ||
    (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]'))) return
  const key = event.key.toLowerCase()
  if (!event.repeat && (key === ' ' || key === 'shift' || key === 'f') && !(key === ' ' && event.target instanceof HTMLElement && event.target.closest('button'))) { event.preventDefault(); dodge(); return }
  if (!event.repeat && key === 'q') { event.preventDefault(); selectMove((fighter.value.selectedMove + 1) % moves.value.length); return }
  if (!event.repeat && ['1','2','3'].includes(key)) { event.preventDefault(); selectMove(Number(key) - 1); return }
  const teammate = teamKeys.indexOf(key)
  if (!event.repeat && roster.value.length > 1 && roster.value[teammate]) { event.preventDefault(); switchMember(teammate); return }
  const direction = keyDirections.get(key)
  if (direction) {
    event.preventDefault()
    if (!event.repeat) keys.value.set(key, direction)
  }
}

function keyup(event: KeyboardEvent) {
  keys.value.delete(event.key.toLowerCase())
}

function updateJoystick(event: PointerEvent) {
  const rect = joystickElement.value?.getBoundingClientRect()
  if (!rect) return
  const radius = Math.min(rect.width, rect.height) * .35
  let x = (event.clientX - (rect.left + rect.width / 2)) / radius
  let y = (event.clientY - (rect.top + rect.height / 2)) / radius
  const length = Math.hypot(x, y)
  if (length > 1) { x /= length; y /= length }
  joystick.value = length < .08 ? { x: 0, y: 0 } : { x, y }
}
function startJoystick(event: PointerEvent) {
  if (event.button !== 0 || suspended.value || !playing || joystickPointer !== undefined) return
  joystickPointer = event.pointerId
  joystickElement.value?.setPointerCapture(event.pointerId)
  updateJoystick(event)
}
function moveJoystick(event: PointerEvent) {
  if (event.pointerId === joystickPointer) updateJoystick(event)
}
function resetJoystick() {
  const pointer = joystickPointer
  joystickPointer = undefined
  joystick.value = { x: 0, y: 0 }
  if (pointer !== undefined && joystickElement.value?.hasPointerCapture(pointer)) joystickElement.value.releasePointerCapture(pointer)
}
function endJoystick(event: PointerEvent) {
  if (event.pointerId === joystickPointer) resetJoystick()
}

function movePlayer(dx: number, dy: number, distance: number) {
  const length = Math.hypot(dx, dy) || 1
  player.value.x = Math.max(4, Math.min(96, player.value.x + dx / length * distance))
  player.value.y = Math.max(5, Math.min(95, player.value.y + dy / length * distance))
}

function nudge(direction: Direction, distance: number) {
  if (!playing || suspended.value) return
  const dx = Number(direction === 'right') - Number(direction === 'left')
  const dy = Number(direction === 'down') - Number(direction === 'up')
  movePlayer(dx, dy, distance)
}

function stopLoop() {
  cancelAnimationFrame(animationId)
  keys.value.clear()
  resetJoystick()
}

function startLoop() {
  accumulatedTime = 0
  previousTime = performance.now()
  animationId = requestAnimationFrame(animate)
}

function pause() {
  if (!playing || suspended.value) return
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
  const member = activeMember.value
  emit('finish', member ? { won, participantIds: [...participantIds], activeMemberId: member.id } : won)
}

function offerUpgrade() {
  const options = [...upgrades]
  upgradeChoices.value = Array.from({ length: 3 }, () => options.splice(Math.floor(Math.random() * options.length), 1)[0]!)
  projectiles.value = []
  effects.value = []
  hit.value = undefined
  stopLoop()
}

function chooseUpgrade(upgrade: Upgrade) {
  if (!playing || document.hidden || !upgradeChoices.value.some(choice => choice.id === upgrade.id)) return
  if (upgrade.id === 'repair') {
    for (const member of roster.value.length ? roster.value : [solo.value]) {
      if (member.hp > 0) member.hp = Math.min(member.maxHp, member.hp + Math.ceil(member.maxHp * .35))
    }
  } else upgradeRanks.value[upgrade.id]++
  waveIndex.value++
  waveDefeated.value = 0
  waveSpawned = 0
  nextSpawnFrame = frame + 45
  upgradeChoices.value = []
  arena.value?.focus({ preventScroll: true })
  startLoop()
}

function pointerAction(event: PointerEvent, action: () => void) {
  if (event.button === 0) action()
}
function keyboardAction(event: MouseEvent, action: () => void) {
  if (event.detail === 0) action()
}
function selectMove(index: number) { if (!suspended.value && playing && moves.value[index]) fighter.value.selectedMove = index }
function switchMember(index: number) {
  const member = roster.value[index]
  if (!playing || suspended.value || !member || member.hp <= 0 || index === activeIndex.value) return
  activeIndex.value = index
  participantIds.add(member.id)
  attacking.value = false
}
function dodge() {
  if (!playing || suspended.value || dodgeCooldown.value > 0) return
  const { x: dx, y: dy } = movement.value
  const length = Math.hypot(dx, dy)
  dodgeDirection = length ? { x: dx / length, y: dy / length } : { ...facing }
  dodgeFrames.value = 16
  dodgeCooldown.value = 135
}
function spawnEnemy(kind: EnemyKind, hp: number) {
  const side = Math.floor(Math.random() * 4)
  const edgePosition = Math.random() * 100
  enemies.value.push({ id: nextId++, x: side === 0 ? 0 : side === 1 ? 100 : edgePosition,
    y: side === 2 ? 0 : side === 3 ? 100 : edgePosition, hp, maxHp: hp,
    kind, cooldown: 40 + Math.floor(Math.random() * 70), windup: 0, radialAttack: false, charge: 0, vx: 0, vy: 0 })
}

function spawnOpponents() {
  const kinds = ['pursuer', 'shooter', 'charger'] as const
  if (!props.adventure) {
    if (frame % 115 === 5 && enemies.value.length < 16) {
      const hp = 4 + Math.max(0, Math.min(difficultyStage ?? props.stage ?? 2, 6)) * .6
      spawnEnemy(kinds[spawnedEnemies++ % kinds.length]!, hp)
    }
    return
  }
  if (frame < nextSpawnFrame) return
  const current = wave.value
  if (current && waveSpawned < current.count) {
    const kindCount = waveIndex.value + 1
    const hp = 2.8 + waveIndex.value * 1.1 + areaDifficulty.value * .3
    spawnEnemy(kinds[waveSpawned++ % kindCount]!, hp)
    nextSpawnFrame = frame + current.interval
  } else if (!current && waveSpawned === 0) {
    waveSpawned++
    spawnEnemy('boss', guardian.value.hp + areaDifficulty.value * 5)
  }
}
function harmEnemy(enemy: Enemy, damage: number) {
  enemy.hp -= damage
  hit.value = { x: enemy.x, y: enemy.y, expires: frame + 8, enemyId: enemy.id }
}
function shoot(x: number, y: number, dx: number, dy: number, damage: number, range: number, color: string, hostile = false, piercing = false) {
  const length = Math.hypot(dx, dy) || 1
  const speed = hostile ? .32 : .8
  projectiles.value.push({ id: nextId++, x, y, vx: dx / length * speed, vy: dy / length * speed,
    remaining: range, damage, color, hostile, piercing, hitIds: [] })
}

function bossEnraged(enemy: Enemy) {
  return enemy.kind === 'boss' && enemy.hp <= enemy.maxHp / 2
}

function releaseEnemyAttack(enemy: Enemy) {
  if (enemy.kind === 'charger') enemy.charge = 25
  else if (enemy.kind === 'shooter') shoot(enemy.x, enemy.y, enemy.vx, enemy.vy, 9, 110, '#ff8d78', true)
  else if (enemy.kind === 'boss') {
    const aim = Math.atan2(enemy.vy, enemy.vx)
    const profile = guardian.value
    const count = enemy.radialAttack ? profile.radial : profile.fan
    for (let index = 0; index < count; index++) {
      const angle = enemy.radialAttack ? index * 2 * Math.PI / count : (index - (count - 1) / 2) * profile.spacing
      const direction = aim + angle
      shoot(enemy.x, enemy.y, Math.cos(direction), Math.sin(direction), 7 + areaDifficulty.value * .25, 110, profile.color, true)
    }
  }
}

function moveCooldown(cooldownMs: number) {
  return cooldownMs * (1 - .18 * upgradeRanks.value.cadence)
}

function attack(nearest: Enemy) {
  const move = activeMove.value
  const range = attackRange.value
  const dx = nearest.x - player.value.x, dy = nearest.y - player.value.y
  const magnitude = Math.hypot(dx, dy)
  const ux = magnitude ? dx / magnitude : facing.x, uy = magnitude ? dy / magnitude : facing.y
  facing = { x: ux, y: uy }
  const power = activeMember.value?.power ?? props.power ?? 0
  const stage = activeMember.value?.stage ?? props.stage ?? 2
  const ap = activeMember.value?.baseAttack
  const basePower = ap && Number.isFinite(ap) && ap > 0 ? Math.min(2.2, Math.max(.9, ap / 1000)) : 1 + Math.max(0, Math.min(stage, 6)) * .16
  const damage = move.power * (1 + Math.min(power, 100) * .10) * basePower * (1 + .30 * upgradeRanks.value.power)
  fighter.value.nextAttackFrame = frame + Math.max(1, Math.round(moveCooldown(move.cooldownMs) / stepMs))
  lastAttack = frame + 10
  attacking.value = true
  if (move.pattern === 'burst' || move.pattern === 'slash') {
    const radius = range
    effects.value.push({ id: nextId++, x: player.value.x, y: player.value.y, expires: frame + 14, radius, color: move.color, kind: move.pattern, angle: Math.atan2(uy, ux) * 180 / Math.PI })
    for (const enemy of enemies.value) {
      const ex = enemy.x - player.value.x, ey = enemy.y - player.value.y
      const d = Math.hypot(ex, ey)
      if (d <= radius && (move.pattern === 'burst' || d === 0 || (ex * ux + ey * uy) / d >= Math.SQRT1_2)) harmEnemy(enemy, damage)
    }
  } else if (move.pattern === 'spread') {
    for (const angle of [-.24, 0, .24]) {
      const c = Math.cos(angle), sin = Math.sin(angle)
      shoot(player.value.x, player.value.y, ux * c - uy * sin, ux * sin + uy * c, damage, range, move.color)
    }
  } else shoot(player.value.x, player.value.y, ux, uy, damage, range, move.color, false, move.pattern === 'pierce')
  if (upgradeRanks.value.cannon > 0)
    shoot(player.value.x, player.value.y, ux, uy, damage * .45 * upgradeRanks.value.cannon, Math.max(range, 38), '#84f7ee', false, true)
}
function tick() {
  frame++
  if (attacking.value && frame >= lastAttack) attacking.value = false
  if (dodgeCooldown.value > 0) dodgeCooldown.value--
  const { x: dx, y: dy } = movement.value
  const invulnerable = dodgeFrames.value > 0
  if (invulnerable) { movePlayer(dodgeDirection.x, dodgeDirection.y, .85); dodgeFrames.value-- }
  else if (dx || dy) { const length = Math.hypot(dx, dy); facing = { x: dx / length, y: dy / length }; movePlayer(dx, dy, .24 * Math.min(length, 1)) }

  spawnOpponents()
  let nearest: Enemy | undefined
  let nearestDistance = Infinity
  for (const enemy of enemies.value) {
    const ex = player.value.x - enemy.x, ey = player.value.y - enemy.y
    const distance = Math.hypot(ex, ey), ux = ex / (distance || 1), uy = ey / (distance || 1)
    if (enemy.cooldown > 0) enemy.cooldown--
    if (enemy.windup > 0) {
      enemy.windup--
      if (enemy.windup === 0) releaseEnemyAttack(enemy)
    } else if (enemy.charge > 0) {
      enemy.x += enemy.vx * .55; enemy.y += enemy.vy * .55; enemy.charge--
    } else {
      const stoppingDistance = enemy.kind === 'boss' ? 23 : enemy.kind === 'shooter' ? 28 : 0
      const speed = props.adventure ? .17 + areaDifficulty.value * .004 : enemy.kind === 'charger' ? .065 : .058
      if (distance > stoppingDistance) {
        enemy.x += ux * Math.min(distance, speed); enemy.y += uy * Math.min(distance, speed)
      }
      if (enemy.kind !== 'pursuer' && enemy.cooldown === 0 && distance < 65) {
        enemy.vx = ux; enemy.vy = uy
        if (enemy.kind === 'boss') {
          enemy.radialAttack = bossEnraged(enemy)
          enemy.windup = enemy.radialAttack ? 38 : 43
          enemy.cooldown = enemy.radialAttack ? guardian.value.rageCooldown : guardian.value.cooldown
        } else {
          enemy.windup = enemy.kind === 'charger' ? 35 : 28
          enemy.cooldown = enemy.kind === 'charger' ? 165 : 120
        }
      }
    }
    if (distance < (enemy.kind === 'boss' ? 10 : 7) && frame % 45 === 0 && !invulnerable) {
      const damage = enemy.kind === 'boss' ? 10 : enemy.charge > 0 ? 9 : 5
      fighter.value.hp = Math.max(0, fighter.value.hp - damage)
    }
    if (distance < nearestDistance) { nearest = enemy; nearestDistance = distance }
  }
  if (hit.value && hit.value.expires <= frame) hit.value = undefined
  if (effects.value.some(effect => effect.expires <= frame)) effects.value = effects.value.filter(effect => effect.expires > frame)
  distanceToTarget.value = nearestDistance
  if (fighter.value.hp > 0 && frame >= teamAttackReadyFrame.value && nearest && targetInRange.value) attack(nearest)
  for (const shot of projectiles.value) {
    shot.x += shot.vx; shot.y += shot.vy; shot.remaining -= Math.hypot(shot.vx, shot.vy)
    if (shot.hostile) {
      if (Math.hypot(shot.x - player.value.x, shot.y - player.value.y) < 4.5) {
        if (!invulnerable) fighter.value.hp = Math.max(0, fighter.value.hp - shot.damage)
        shot.remaining = 0
      }
    } else {
      for (const enemy of enemies.value) {
        if (enemy.hp > 0 && !shot.hitIds.includes(enemy.id) && Math.hypot(shot.x - enemy.x, shot.y - enemy.y) < (enemy.kind === 'boss' ? 8 : 5)) {
          harmEnemy(enemy, shot.damage); shot.hitIds.push(enemy.id)
          if (!shot.piercing) { shot.remaining = 0; break }
        }
      }
    }
  }
  if (projectiles.value.some(shot => shot.remaining <= 0 || shot.x < -5 || shot.x > 105 || shot.y < -5 || shot.y > 105))
    projectiles.value = projectiles.value.filter(shot => shot.remaining > 0 && shot.x >= -5 && shot.x <= 105 && shot.y >= -5 && shot.y <= 105)
  if (enemies.value.some(enemy => enemy.hp <= 0)) {
    const alive = enemies.value.filter(enemy => enemy.hp > 0)
    const kills = enemies.value.length - alive.length
    defeated.value += kills
    if (props.adventure) waveDefeated.value += kills
    enemies.value = alive
  }
  if (!props.adventure && frame % 50 === 0) time.value--
  const won = props.adventure ? !wave.value && waveDefeated.value > 0 : time.value <= 0
  if (fighter.value.hp <= 0) {
    const reserve = roster.value.findIndex(member => member.hp > 0)
    if (reserve === -1) { finish(false); return }
    if (!won) switchMember(reserve)
  }
  if (won) finish(true)
  else if (props.adventure && wave.value && waveDefeated.value === wave.value.count) offerUpgrade()
}

function animate(timestamp: number) {
  if (!playing || suspended.value) return
  // Keep combat and the countdown in sync after a long render stall.
  accumulatedTime += Math.max(0, Math.min(timestamp - previousTime, 100))
  previousTime = timestamp
  while (playing && !suspended.value && accumulatedTime >= stepMs) {
    accumulatedTime -= stepMs
    tick()
  }
  if (playing && !suspended.value) animationId = requestAnimationFrame(animate)
}

watch(paused, value => {
  if (value && !document.hidden) resumeButton.value?.focus({ preventScroll: true })
}, { flush: 'post' })
watch(upgradeChoices, choices => {
  if (choices.length && !document.hidden) upgradePanel.value?.querySelector('button')?.focus({ preventScroll: true })
}, { flush: 'post' })

onMounted(() => {
  updateFieldAspect()
  window.addEventListener('resize', updateFieldAspect)
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
  window.removeEventListener('resize', updateFieldAspect)
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('keyup', keyup)
  window.removeEventListener('blur', pause)
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<template>
  <section ref="arena" class="arena" tabindex="-1" :aria-label="adventure ? `Expedição, área ${areaNumber}` : 'Arena Survivor'">
    <div class="arena-header">
      <span>{{ adventure ? `ÁREA ${areaNumber}` : 'ARENA SURVIVOR' }}</span>
      <strong>{{ adventure ? wave ? `ONDA ${waveIndex + 1}/${waves.length}` : 'CHEFE' : `${time}s` }}</strong>
      <span>{{ adventure && wave ? `${waveDefeated}/${wave.count}` : defeated }} DERROTADOS</span>
    </div>
    <div ref="field" class="arena-field" :class="{ 'is-paused': suspended }">
      <div v-for="enemy in enemies" :key="enemy.id" class="enemy" :class="[enemy.kind, { struck: hit?.enemyId === enemy.id, warning: enemy.windup > 0, enraged: bossEnraged(enemy) }]" :style="{ left: enemy.x + '%', top: enemy.y + '%', '--enemy-delay': (enemy.id % 5) * -.12 + 's' }">
        <span v-if="enemy.windup > 0 && !enemy.radialAttack" class="enemy-aim" aria-hidden="true" :style="{ transform: `rotate(${Math.atan2(enemy.vy, enemy.vx * fieldAspect)}rad)` }"></span>
        <span class="enemy-sprite" aria-hidden="true" :class="{ 'is-cel-shaded': enemySheets[enemy.kind].celShaded }" :style="{ backgroundImage: enemySheets[enemy.kind].backgroundImage }"></span>
        <div v-if="enemy.kind !== 'boss'" class="enemy-hp"><span :style="{ width: 100 * enemy.hp / enemy.maxHp + '%' }"></span></div>
      </div>
      <div v-for="shot in projectiles" :key="shot.id" class="projectile" :class="{ hostile: shot.hostile }" :style="{left: shot.x + '%', top: shot.y + '%', background: shot.color}"></div>
      <div v-for="effect in effects" :key="effect.id" class="attack-effect" :class="effect.kind" :style="{left: effect.x + '%', top: effect.y + '%', width: effect.radius * 2 + '%', height: effect.radius * 2 + '%', borderColor: effect.color, transform: `translate(-50%,-50%) rotate(${effect.angle}deg)`}"></div>
      <div v-if="hit" class="hit" aria-hidden="true" :style="{ left: hit.x + '%', top: hit.y + '%' }"></div>
      <div class="fighter" :class="{ moving: Math.hypot(movement.x, movement.y) > 0, attacking: attacking, dodging: dodgeFrames > 0 }" :style="{ left: player.x + '%', top: player.y + '%' }">
        <AnimatedSprite :key="activeMember?.id" :sheet="activeMember ? activeMember.sheet : sheet" :fallback="activeMember?.sprite ?? sprite" :label="activeMember?.name ?? 'Parceiro'" :frames="fighterFrames" :paused="suspended" :interval="120" />
      </div>
      <div v-if="boss" class="boss-hud" :class="{ enraged: bossEnraged(boss) }">
        <strong>{{ guardian.name }}</strong><span v-if="bossEnraged(boss)"> · FÚRIA</span>
        <div class="boss-hp" role="progressbar" :aria-label="`Vida de ${guardian.name}`" :aria-valuenow="Math.ceil(boss.hp)" :aria-valuemax="boss.maxHp">
          <span :style="{ width: 100 * boss.hp / boss.maxHp + '%' }"></span>
        </div>
      </div>
      <div v-if="paused" class="pause-screen">
        <strong>Batalha pausada</strong>
        <button ref="resumeButton" type="button" class="arena-action" @click="resume">Retomar batalha</button>
      </div>
      <div v-else-if="upgradeChoices.length" ref="upgradePanel" class="pause-screen upgrade-screen" role="group" aria-label="Escolha uma melhoria">
        <div><strong>ONDA {{ waveIndex + 1 }} CONCLUÍDA</strong><small>Escolha uma melhoria para esta expedição.</small></div>
        <div class="upgrade-list">
          <button v-for="upgrade in upgradeChoices" :key="upgrade.id" class="arena-action upgrade-button" type="button" @click="chooseUpgrade(upgrade)">
            <strong>{{ upgrade.name }}</strong><small>{{ upgrade.description }}</small>
          </button>
        </div>
      </div>
    </div>
    <div class="arena-health">
      <span>HP</span>
      <div role="progressbar" :aria-label="activeMember ? `Vida de ${activeMember.name}` : 'Vida do parceiro'" :aria-valuenow="fighter.hp" :aria-valuemax="fighter.maxHp">
        <span :style="{ width: 100 * fighter.hp / fighter.maxHp + '%' }"></span>
      </div>
      <strong>{{ fighter.hp }}/{{ fighter.maxHp }}</strong>
    </div>
    <div v-if="roster.length > 1" class="arena-team" role="group" aria-label="Trocar Digimon ativo">
      <button v-for="(member, index) in roster" :key="member.id" type="button" class="team-member"
        :class="{ selected: index === activeIndex }" :aria-pressed="index === activeIndex"
        :aria-keyshortcuts="teamKeys[index]" :disabled="suspended || member.hp <= 0"
        @pointerdown.stop.prevent="pointerAction($event, () => switchMember(index))" @click="keyboardAction($event, () => switchMember(index))">
        <strong>{{ member.name }}</strong><small>{{ member.hp > 0 ? `${member.hp}/${member.maxHp} HP` : 'Fora de combate' }}</small>
      </button>
    </div>
    <p class="arena-credit">Sprites: templates BEM e Greymon por EvilGavin · Digital Link</p>
    <p v-if="adventure">Elimine as três ondas e o chefe para concluir a área. Escolha uma melhoria entre ondas. Os inimigos sinalizam antes de disparar ou avançar.</p>
    <p v-else>Sobreviva por {{ duration }} segundos. O ataque selecionado é automático. Inimigos piscam antes de atirar ou avançar. Os golpes são adaptados para cada parceiro e ficam mais fortes com estágio e treino.</p>
    <div class="move-list" role="group" aria-label="Selecionar ataque automático">
      <button v-for="(move, index) in moves" :key="index" class="move-button" type="button" :class="{ selected: fighter.selectedMove === index }" :aria-pressed="fighter.selectedMove === index" :disabled="suspended" @pointerdown.stop.prevent="pointerAction($event, () => selectMove(index))" @click="keyboardAction($event, () => selectMove(index))">
        <strong>{{ move.name }}</strong><small>{{ move.pattern === 'shot' ? 'Disparo' : move.pattern === 'spread' ? 'Rajada' : move.pattern === 'pierce' ? 'Perfuração' : move.pattern === 'burst' ? 'Área' : 'Golpe próximo' }} · {{ (moveCooldown(move.cooldownMs) / 1000).toFixed(1) }}s</small>
        <small v-if="fighter.selectedMove === index && !targetInRange && !suspended" class="attack-range">{{ distanceToTarget === Infinity ? 'Sem alvo' : 'Fora de alcance' }}</small>
      </button>
    </div>
    <div class="combat-controls">
    <div class="movement-controls">
      <div ref="joystickElement" class="joystick" :class="{ disabled: suspended }"
        aria-hidden="true" @pointerdown.prevent="startJoystick" @pointermove.prevent="moveJoystick"
        @pointerup="endJoystick" @pointercancel="endJoystick" @lostpointercapture="endJoystick" @contextmenu.prevent>
        <span class="joystick-knob" :style="{ transform: `translate(calc(-50% + ${joystick.x * 70}%), calc(-50% + ${joystick.y * 70}%))` }"></span>
      </div>
      <div class="accessible-directions" role="group" aria-label="Movimento por botões">
        <button v-for="direction in directions" :key="direction.id" type="button" :aria-label="direction.label"
          :disabled="suspended" @click="nudge(direction.id, 1.2)">{{ direction.symbol }}</button>
      </div>
    </div>
    <button type="button" class="dodge-button" :disabled="suspended || dodgeCooldown > 0" @pointerdown.stop.prevent="pointerAction($event, dodge)" @click="keyboardAction($event, dodge)">ESQUIVAR <small>{{ dodgeCooldown > 0 ? (dodgeCooldown * stepMs / 1000).toFixed(1) + 's' : 'PRONTO' }}</small></button>
    </div>
    <p class="arena-tip">Arraste o controle para mover; quanto mais longe do centro, mais rápido. Teclado: setas ou WASD movem; 1–3 ou Q escolhe ataque; espaço, F ou Shift esquiva.<template v-if="roster.length > 1"> Use {{ teamKeys[0] }}–{{ teamKeys[roster.length - 1] }} para trocar de Digimon.</template></p>
    <div class="arena-actions">
      <button type="button" class="arena-action" :disabled="suspended" @click="pause">Pausar</button>
      <button type="button" class="arena-action" @click="finish(false)">Sair da batalha</button>
    </div>
  </section>
</template>

<style scoped>
.arena-field { height: clamp(190px, 36svh, 340px); }
.arena-credit { margin:5px 0; font-size:9px!important; }
.arena-tip { margin:6px 0; }
@media(max-height:740px){.arena-field{height:29svh;min-height:170px}.arena p{margin:5px 0}.move-list{margin:6px 0}.move-button{min-height:50px}.arena-actions{margin-top:5px}}
.movement-controls { position:relative; }
.joystick { position:relative; width:140px; height:140px; border:2px solid #729a79; border-radius:50%; background:radial-gradient(circle, #3c5849 0 34%, #213533 35% 100%); touch-action:none; user-select:none; }
.joystick.disabled { opacity:.5; }
.joystick-knob { position:absolute; left:50%; top:50%; width:50%; height:50%; border:2px solid #d5efbb; border-radius:50%; background:#668b67; box-shadow:0 3px 8px #0008; pointer-events:none; }
.accessible-directions { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
.accessible-directions:focus-within { display:flex; position:absolute; bottom:100%; left:0; width:auto; height:auto; overflow:visible; clip-path:none; gap:4px; z-index:4; }
.accessible-directions button { min-width:44px; min-height:44px; border:1px solid #527061; border-radius:6px; color:#d5efbb; background:#263a3b; }
.arena-actions { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
.arena-action { min-height: 44px; padding: 6px 12px; border: 1px solid #527061; border-radius: 8px; background: #263a3b; color: #d5efbb; }
.arena button:disabled { opacity: .5; }
.pause-screen { position: absolute; inset: 0; z-index:4; display: grid; place-content: center; gap: 10px; text-align: center; background: #111b25e6; }
.upgrade-screen { align-content:start; align-content:safe center; justify-content:stretch; overflow-y:auto; overscroll-behavior-y:contain; touch-action:pan-y; padding:8px; color:#eef7db; }
.upgrade-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
.upgrade-button { padding:7px 5px; font-size:11px; overflow-wrap:anywhere; }
.upgrade-screen small { display:block; margin-top:4px; font-size:10px; color:#c0d0be; }
.upgrade-button:focus-visible { outline:2px solid #c7f56b; outline-offset:1px; }
.unit-marker { display: block; width: 28px; height: 28px; margin: 10px auto; border: 2px solid #fff; border-radius: 50%; background: #c5f76a; }
.enemy-marker { background: #ff877d; }
.fighter .animated-sprite, .fighter .animated-fallback { transform-origin: 50% 90%; animation: fighter-idle 1.5s ease-in-out infinite; }
.fighter.moving .animated-sprite, .fighter.moving .animated-fallback { animation: fighter-move .32s ease-in-out infinite alternate; }
.fighter.attacking .animated-sprite, .fighter.attacking .animated-fallback { animation: fighter-attack .16s ease-out; }
.enemy .enemy-sprite { display:block; width:100%; height:100%; image-rendering:var(--sprite-image-rendering, pixelated); background-size:1200% 100%; background-repeat:no-repeat; background-position:18.1818% 0; transform-origin:50% 90%; animation: enemy-frames .5s steps(1) var(--enemy-delay) infinite, enemy-move .55s ease-in-out var(--enemy-delay) infinite alternate; }
.enemy.boss { width:76px; height:76px; }
.enemy.boss.enraged { filter:drop-shadow(0 0 8px #ff6975); }
.boss-hud { position:absolute; z-index:3; top:6px; left:12%; right:12%; text-align:center; pointer-events:none; color:#ffe8e4; font-size:11px; text-shadow:0 1px 3px #111b25; }
.boss-hp { height:7px; margin-top:3px; border:1px solid #f4b5ad; border-radius:9px; background:#38292b; }
.boss-hp span { display:block; height:100%; border-radius:9px; background:#ff917d; }
.boss-hud.enraged .boss-hp span { background:#ff536e; }
.enemy.struck .enemy-sprite { animation: enemy-hit .16s ease-out; }
.hit { pointer-events: none; animation: hit-flash .16s ease-out both; }
.is-paused .fighter .animated-sprite, .is-paused .fighter .animated-fallback, .is-paused .enemy .enemy-sprite, .is-paused .enemy.warning:before, .is-paused .hit { animation-play-state: paused; }
@keyframes fighter-idle { 50% { transform: translateY(-2px); } }
@keyframes fighter-move { from { transform: translateY(0) rotate(-4deg); } to { transform: translateY(-3px) rotate(4deg); } }
@keyframes fighter-attack { 45% { transform: translateY(-4px) scale(1.12, .9); } }
@keyframes enemy-frames { 50% { background-position:27.2727% 0; } }
@keyframes enemy-move { from { transform: rotate(-3deg); } to { transform: translateY(-2px) rotate(3deg); } }
@keyframes enemy-hit { 35% { transform: scale(.85, 1.12); filter: brightness(1.8); } }
@keyframes hit-flash { from { opacity: 1; transform: translate(-50%, -50%) scale(.5); } to { opacity: 0; transform: translate(-50%, -50%) scale(2); } }
@media (prefers-reduced-motion: reduce) {
  .fighter .animated-sprite, .fighter .animated-fallback, .enemy .enemy-sprite, .hit { animation: none; }
}

.move-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin:12px 0; }
.arena-team { display:grid; grid-auto-columns:minmax(0,1fr); grid-auto-flow:column; gap:6px; margin:8px 0; }
.move-button,.team-member { min-height:62px; padding:6px; border:1px solid #405750; border-radius:9px; color:#dfeee3; background:#1c2c30; overflow-wrap:anywhere; }
.team-member { min-height:44px; touch-action:manipulation; }
.move-button strong,.move-button small,.team-member strong,.team-member small { display:block; }
.move-button strong,.team-member strong { font-size:11px; }
.move-button small,.team-member small { font-size:9px; margin-top:4px; color:#9eb6aa; }
.move-button .attack-range { color:#ffdb9b; }
.move-button.selected,.team-member.selected { border-color:#c7f56b; background:#344b37; box-shadow:inset 0 0 0 1px #c7f56b; }
.combat-controls { display:flex; justify-content:center; align-items:center; gap:24px; }
.dodge-button { min-height:72px; min-width:95px; padding:10px; border:1px solid #b2df72; border-radius:14px; color:#eaf7dd; background:#385340; font-weight:700; touch-action:manipulation; }
.dodge-button small { display:block; font-size:10px; margin-top:5px; }
.arena-tip { font-size:10px!important; }
.projectile { position:absolute; width:10px; height:10px; border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 8px currentColor; pointer-events:none; }
.projectile.hostile { width:12px; height:12px; border:2px solid #ffdfc1; }
.attack-effect { position:absolute; transform:translate(-50%,-50%); border:3px solid; border-radius:50%; opacity:.65; pointer-events:none; }
.attack-effect.slash { border-style:dashed; clip-path:polygon(50% 50%, 100% 0, 100% 100%); } .enemy-aim { position:absolute; left:50%; top:50%; width:75px; height:2px; background:#ffb96b; transform-origin:left center; opacity:.85; } .enemy.warning:before { content:''; position:absolute; inset:-8px; border:2px dashed #ffb96b; border-radius:50%; animation: warning-pulse .35s ease-in-out infinite alternate; }
.enemy.shooter .enemy-hp span { background:#ffb76c; } .enemy.charger .enemy-hp span { background:#e79cff; }
.fighter.dodging { opacity:.55; filter:drop-shadow(0 0 10px #ecffad); }
@keyframes warning-pulse { from { opacity:.35; transform:scale(.85) } to { opacity:1; transform:scale(1.2) } }
@media(max-width:360px) { .combat-controls { gap:10px; } .dodge-button { min-width:80px; } }
@media(prefers-reduced-motion:reduce) { .enemy.warning:before { animation:none; opacity:1; } }


@media (orientation:landscape) and (max-height:550px) {
  .arena { display:grid; grid-template-columns:minmax(0,1fr) minmax(225px,.75fr); gap:5px 12px; align-items:start; }
  .arena-header { grid-column:1; grid-row:1; }
  .arena-field { grid-column:1; grid-row:2 / span 5; height:calc(100svh - 140px); min-height:150px; }
  .arena-health { grid-column:1; grid-row:7; margin-top:0; }
  .arena-team { grid-column:1; grid-row:8; margin:0; }
  .arena-credit { grid-column:1; grid-row:8; }
  .arena-team + .arena-credit { grid-row:9; }
  .arena > p:not(.arena-credit):not(.arena-tip) { display:none; }
  .move-list { grid-column:2; grid-row:1 / span 2; margin:0; }
  .combat-controls { grid-column:2; grid-row:3; }
  .arena-tip { grid-column:2; grid-row:4; }
  .arena-actions { grid-column:2; grid-row:5; margin-top:0; }
}

</style>
