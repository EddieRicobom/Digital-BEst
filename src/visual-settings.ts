import { computed, reactive, watch } from 'vue'
import './visual-effects.css'

type VisualPreferences = {
  gbaDisplay: boolean
  smoothing: 'nitido' | 'suave'
  celShading: boolean
}

const storageKey = 'digital-companion-visual-v1'

export function normalizeVisualPreferences(value: unknown): VisualPreferences {
  const saved = value && typeof value === 'object' ? value as Partial<VisualPreferences> : {}
  return {
    gbaDisplay: saved.gbaDisplay === true,
    smoothing: saved.smoothing === 'suave' ? 'suave' : 'nitido',
    celShading: saved.celShading === true,
  }
}

function readPreferences(): VisualPreferences {
  try {
    return normalizeVisualPreferences(JSON.parse(localStorage.getItem(storageKey) ?? 'null'))
  } catch {
    return normalizeVisualPreferences(null)
  }
}

export const visualPreferences = reactive(readPreferences())

watch(visualPreferences, value => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // A preferência continua disponível durante a sessão.
  }
})

export const visualClasses = computed(() => ({
  'gba-display': visualPreferences.gbaDisplay,
  'sprites-soft': visualPreferences.smoothing === 'suave',
  'sprites-cel-shaded': visualPreferences.celShading,
}))
