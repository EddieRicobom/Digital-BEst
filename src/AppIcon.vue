<script setup lang="ts">
import { computed } from 'vue'
import { Brain, Clover, Coins, Compass, Cpu, Dumbbell, Flame, Footprints, Gem, Gift, HeartPulse, Shield, Sparkles, Target, Timer, Trophy, UserRound, Zap } from '@lucide/vue'

const icons = {
  partner: UserRound,
  adventure: Compass,
  evolution: Sparkles,
  health: HeartPulse,
  nucleo: Cpu,
  power: Dumbbell,
  stamina: Footprints,
  coins: Coins,
  flame: Flame,
  trophy: Trophy,
  zap: Zap,
  shield: Shield,
  timer: Timer,
  clover: Clover,
  brain: Brain,
  target: Target,
  gift: Gift,
  gem: Gem,
  footprints: Footprints,
  dumbbell: Dumbbell,
}

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const icon = computed(() => icons[props.name as keyof typeof icons] ?? Sparkles)
</script>

<template>
  <component :is="icon" class="app-icon" :size="size" aria-hidden="true" focusable="false" />
</template>

<style scoped>
.app-icon { display: block; flex: none; }
</style>
