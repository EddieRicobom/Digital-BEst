<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useSpriteSheet } from './sprite-effects'
const props = withDefaults(defineProps<{ sheet?: string; fallback?: string; label: string; frames?: number[]; paused?: boolean; interval?: number; frameWidth?: number; frameHeight?: number; frameCount?: number }>(), { sheet: '', fallback: '', frames: () => [0, 1], paused: false, interval: 500, frameWidth: 64, frameHeight: 56, frameCount: 12 })
const sheetFailed = ref(false)
const fallbackFailed = ref(false)
const index = ref(0)
const reduced = ref(false)
const mounted = ref(false)
let media: MediaQueryList | undefined
const currentFrame = computed(() => props.frames[index.value % props.frames.length] ?? 0)
const position = computed(() => props.frameCount > 1 ? `${currentFrame.value * 100 / (props.frameCount - 1)}%` : '0%')
const canAnimate = computed(() => mounted.value && !reduced.value && !props.paused && !!props.sheet && !sheetFailed.value && props.frames.length > 1)
const renderedSheet = useSpriteSheet(() => props.sheet, () => props.frameWidth, () => props.frameHeight, () => props.frameCount)
function syncMotion() { reduced.value = !!media?.matches }
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMotion()
  media.addEventListener('change', syncMotion)
  mounted.value = true
})
onUnmounted(() => { media?.removeEventListener('change', syncMotion) })
watch([canAnimate, () => props.interval], ([animate, interval], _, onCleanup) => {
  if (!animate) return
  const timer = setInterval(() => { if (!document.hidden) index.value++ }, interval)
  onCleanup(() => clearInterval(timer))
})
watch(() => props.sheet, () => { sheetFailed.value = false; index.value = 0 })
watch(() => props.fallback, () => { fallbackFailed.value = false })
watch(() => props.frames.join(','), () => { index.value = 0 })
</script>
<template>
  <span v-if="sheet && !sheetFailed" class="animated-sprite" role="img" :aria-label="label" :style="{ aspectRatio: `${frameWidth} / ${frameHeight}` }">
    <img :src="sheet" alt="" aria-hidden="true" class="sprite-loader" @error="sheetFailed = true">
    <span class="sprite-frame" :class="{ 'is-cel-shaded': renderedSheet.celShaded }" :style="{ backgroundImage: renderedSheet.backgroundImage, backgroundSize: `${frameCount * 100}% 100%`, backgroundPosition: `${position} 0` }"></span>
  </span>
  <img v-else-if="fallback && !fallbackFailed" class="animated-fallback" :src="fallback" :alt="label" @error="fallbackFailed = true">
  <span v-else class="sprite-unavailable" role="img" :aria-label="`${label}: imagem indisponível`">Imagem indisponível</span>
</template>
<style scoped>
.animated-sprite { display:block; height:100%; max-width:100%; position:relative; }
.sprite-loader { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
.sprite-frame { position:absolute; inset:0; background-repeat:no-repeat; image-rendering:var(--sprite-image-rendering, pixelated); }
.animated-fallback { max-width:100%; max-height:100%; object-fit:contain; image-rendering:var(--sprite-image-rendering, pixelated); }
.sprite-unavailable { font-size:10px; }
</style>
