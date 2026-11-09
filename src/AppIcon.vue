<script setup lang="ts">
import { Compass, Dumbbell, Footprints, HeartPulse, Sparkles, UserRound } from '@lucide/vue'

const icons = {
  partner: UserRound,
  adventure: Compass,
  evolution: Sparkles,
  health: HeartPulse,
  power: Dumbbell,
  stamina: Footprints,
}

withDefaults(defineProps<{ name: keyof typeof icons; size?: number }>(), { size: 20 })
</script>

<template>
  <component :is="icons[name]" class="app-icon" :size="size" aria-hidden="true" focusable="false" />
</template>

<style scoped>
.app-icon { display: block; flex: none; }
</style>
