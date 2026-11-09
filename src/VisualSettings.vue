<script setup lang="ts">
import { useId } from 'vue'
import { visualPreferences } from './visual-settings'

const lcdId = useId()
const smoothingId = useId()
const celId = useId()
</script>

<template>
  <fieldset class="visual-settings">
    <legend>Visual</legend>
    <label class="visual-option">
      <input v-model="visualPreferences.gbaDisplay" type="checkbox" :aria-labelledby="lcdId" :aria-describedby="`${lcdId}-hint`">
      <span><strong :id="lcdId">LCD de GBA</strong><small :id="`${lcdId}-hint`">Aplica uma grade fina e um tom esverdeado à tela do parceiro e à arena.</small></span>
    </label>
    <label class="visual-option visual-select">
      <span><strong :id="smoothingId">Nitidez dos sprites</strong><small :id="`${smoothingId}-hint`">Nítido preserva o pixel art. Suave arredonda as bordas.</small></span>
      <select v-model="visualPreferences.smoothing" :aria-labelledby="smoothingId" :aria-describedby="`${smoothingId}-hint`">
        <option value="nitido">Nítido</option>
        <option value="suave">Suave</option>
      </select>
    </label>
    <label class="visual-option">
      <input v-model="visualPreferences.celShading" type="checkbox" :aria-labelledby="celId" :aria-describedby="`${celId}-hint`">
      <span><strong :id="celId">Cel shading</strong><small :id="`${celId}-hint`">Realça o contorno e aplica luz e sombra chapadas aos sprites locais.</small></span>
    </label>
  </fieldset>
</template>

<style scoped>
.visual-settings { min-width: 0; margin: 0; padding: 12px; border: 1px solid #354b50; border-radius: 10px; }
.visual-settings legend { padding-inline: 6px; color: #c4f36a; font-weight: 700; }
.visual-option { display: flex; align-items: center; gap: 10px; min-height: 48px; }
.visual-option + .visual-option { margin-top: 6px; }
.visual-option input { width: 18px; height: 18px; flex: 0 0 auto; accent-color: #c4f36a; }
.visual-option strong, .visual-option small { display: block; }
.visual-option small { margin-top: 3px; color: #a5b5bd; line-height: 1.4; }
.visual-select { justify-content: space-between; flex-wrap: wrap; }
.visual-option select { min-height: 36px; padding-inline: 6px; border: 1px solid #527063; border-radius: 6px; color: inherit; background: #1b2932; }
</style>
