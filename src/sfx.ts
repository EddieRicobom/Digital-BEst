/**
 * Efeitos sonoros sintetizados com WebAudio. Sem arquivos externos, sem
 * timers: cada som é agendado no próprio relógio do áudio. Em ambientes sem
 * AudioContext (testes, navegadores antigos) tudo vira no-op.
 */
import { reactive, watch } from 'vue'

export type SoundName = 'hit' | 'cast' | 'kill' | 'hurt' | 'upgrade' | 'victory' | 'defeat' | 'reward' | 'click' | 'sync'

const storageKey = 'digital-companion-sound-v1'
const throttleMs: Partial<Record<SoundName, number>> = { hit: 45, cast: 90, kill: 80, hurt: 180 }

function readEnabled(): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as { enabled?: unknown } | null
    return saved?.enabled !== false
  } catch {
    return true
  }
}

export const soundPreferences = reactive({ enabled: readEnabled() })

watch(soundPreferences, value => {
  try { localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* sessão apenas */ }
})

let context: AudioContext | null = null
let master: GainNode | null = null
const lastPlayed: Partial<Record<SoundName, number>> = {}

type AudioContextConstructor = new () => AudioContext

function audioConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const candidate = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
  return typeof candidate === 'function' ? candidate : undefined
}

function ensureContext(): AudioContext | null {
  if (!soundPreferences.enabled) return null
  if (context) return context
  const Constructor = audioConstructor()
  if (!Constructor) return null
  try {
    context = new Constructor()
    master = context.createGain()
    master.gain.value = 0.16
    master.connect(context.destination)
  } catch {
    context = null
    master = null
  }
  return context
}

type Note = { frequency: number; duration: number; type?: OscillatorType; offset?: number; volume?: number; slide?: number }

const patterns: Record<SoundName, Note[]> = {
  hit: [
    { frequency: 460, duration: 0.05, type: 'square', volume: 0.35, slide: -120 },
  ],
  cast: [
    { frequency: 320, duration: 0.08, type: 'triangle', volume: 0.4, slide: 180 },
  ],
  kill: [
    { frequency: 240, duration: 0.12, type: 'sawtooth', volume: 0.4, slide: -150 },
    { frequency: 620, duration: 0.1, type: 'square', offset: 0.05, volume: 0.22 },
  ],
  hurt: [
    { frequency: 180, duration: 0.16, type: 'sawtooth', volume: 0.5, slide: -90 },
  ],
  upgrade: [
    { frequency: 523, duration: 0.09, type: 'triangle', volume: 0.35 },
    { frequency: 659, duration: 0.09, type: 'triangle', offset: 0.08, volume: 0.35 },
    { frequency: 784, duration: 0.14, type: 'triangle', offset: 0.16, volume: 0.35 },
  ],
  victory: [
    { frequency: 523, duration: 0.12, type: 'triangle', volume: 0.4 },
    { frequency: 659, duration: 0.12, type: 'triangle', offset: 0.1, volume: 0.4 },
    { frequency: 784, duration: 0.12, type: 'triangle', offset: 0.2, volume: 0.4 },
    { frequency: 1046, duration: 0.28, type: 'triangle', offset: 0.3, volume: 0.45 },
  ],
  defeat: [
    { frequency: 300, duration: 0.18, type: 'sawtooth', volume: 0.35, slide: -80 },
    { frequency: 220, duration: 0.28, type: 'sawtooth', offset: 0.16, volume: 0.3, slide: -60 },
  ],
  reward: [
    { frequency: 880, duration: 0.08, type: 'square', volume: 0.25 },
    { frequency: 1174, duration: 0.16, type: 'square', offset: 0.07, volume: 0.22 },
  ],
  click: [
    { frequency: 660, duration: 0.035, type: 'square', volume: 0.18 },
  ],
  sync: [
    { frequency: 220, duration: 0.14, type: 'sawtooth', volume: 0.3, slide: 220 },
    { frequency: 440, duration: 0.18, type: 'square', offset: 0.06, volume: 0.26, slide: 260 },
    { frequency: 880, duration: 0.34, type: 'triangle', offset: 0.14, volume: 0.4, slide: 140 },
  ],
}

export function playSound(name: SoundName): void {
  if (!soundPreferences.enabled) return
  const now = typeof performance !== 'undefined' ? performance.now() : 0
  const gap = throttleMs[name] ?? 0
  if (gap && lastPlayed[name] !== undefined && now - lastPlayed[name]! < gap) return
  lastPlayed[name] = now
  const audio = ensureContext()
  if (!audio || !master) return
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined)
  let offset = 0
  for (const note of patterns[name]) {
    offset = note.offset ?? offset
    try {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = note.type ?? 'triangle'
      oscillator.frequency.setValueAtTime(note.frequency, audio.currentTime + offset)
      if (note.slide) {
        oscillator.frequency.linearRampToValueAtTime(
          Math.max(40, note.frequency + note.slide),
          audio.currentTime + offset + note.duration,
        )
      }
      const volume = (note.volume ?? 0.3)
      gain.gain.setValueAtTime(0.0001, audio.currentTime + offset)
      gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + offset + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + offset + note.duration)
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(audio.currentTime + offset)
      oscillator.stop(audio.currentTime + offset + note.duration + 0.02)
    } catch {
      // Um som que falha nunca deve interromper a batalha.
    }
  }
}
