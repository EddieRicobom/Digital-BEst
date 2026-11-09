import { computed, shallowRef, watch } from 'vue'
import { visualPreferences } from './visual-settings'

type SpriteSheet = { url: string; celShaded: boolean }
const variants = new Map<string, Promise<string | null>>()
const maxVariants = 12
const maxSheetPixels = 128_000

/** Applies flat, hue-preserving bands and a hard light/shadow rim to one frame. */
export function shadeSpriteFrame(data: Uint8ClampedArray, width: number, height: number): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] === 0) continue

      const luminance = (54 * data[i]! + 183 * data[i + 1]! + 19 * data[i + 2]!) / 256
      const lightEdge = x === 0 || y === 0 || data[i - (width + 1) * 4 + 3]! < 128
      const shadowEdge = x === width - 1 || y === height - 1 || data[i + (width + 1) * 4 + 3]! < 128
      let gain = luminance < 84 ? 0.76 : luminance < 176 ? 1 : 1.13
      if (shadowEdge && !lightEdge) gain *= 0.74
      if (lightEdge && !shadowEdge) gain *= 1.19
      for (let channel = 0; channel < 3; channel++) data[i + channel] = data[i + channel]! * gain
    }
  }
}

/** Scale2x (EPX), with neighbors clamped to the current frame. */
function scaleFrame(data: Uint8ClampedArray, width: number, height: number): ImageData {
  const pixels = new Uint32Array(data.buffer, data.byteOffset, width * height)
  const output = new ImageData(width * 2, height * 2)
  const enlarged = new Uint32Array(output.data.buffer)
  const equal = (a: number, b: number) => (data[a * 4 + 3] === 0 && data[b * 4 + 3] === 0) || pixels[a] === pixels[b]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const center = y * width + x
      const up = y > 0 ? center - width : center
      const down = y < height - 1 ? center + width : center
      const left = x > 0 ? center - 1 : center
      const right = x < width - 1 ? center + 1 : center
      const target = (y * width * 2 + x) * 2
      const smoothCorner = !equal(up, down) && !equal(left, right)
      enlarged[target] = pixels[smoothCorner && equal(up, left) ? up : center]!
      enlarged[target + 1] = pixels[smoothCorner && equal(up, right) ? up : center]!
      enlarged[target + width * 2] = pixels[smoothCorner && equal(down, left) ? down : center]!
      enlarged[target + width * 2 + 1] = pixels[smoothCorner && equal(down, right) ? down : center]!
    }
  }
  return output
}

function localSheetUrl(source: string): string | null {
  if (!source || typeof window === 'undefined') return null
  try {
    const url = new URL(source, document.baseURI)
    const assets = new URL(`${import.meta.env.BASE_URL}assets/sprites/`, document.baseURI)
    if (url.origin !== window.location.origin || !url.pathname.startsWith(assets.pathname) || !url.pathname.endsWith('.png')) return null
    return url.href
  } catch {
    return null
  }
}

function encodeSheet(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')).then(blob => {
    if (!blob) return null
    return new Promise<string | null>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = reader.onabort = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  })
}

async function buildSheet(url: string, width: number, height: number, count: number, smooth: boolean, shade: boolean): Promise<string | null> {
  const response = await fetch(url, { mode: 'same-origin', redirect: 'error' })
  if (!response.ok) return null
  const bitmap = await createImageBitmap(await response.blob())
  try {
    if (bitmap.width !== width * count || bitmap.height !== height) return null
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = width
    frameCanvas.height = height
    const frame = frameCanvas.getContext('2d', { willReadFrequently: true })
    const canvas = document.createElement('canvas')
    const factor = smooth ? 2 : 1
    canvas.width = width * count * factor
    canvas.height = height * factor
    const output = canvas.getContext('2d')
    if (!frame || !output) return null

    for (let index = 0; index < count; index++) {
      // Let the browser paint between small batches while the original sheet is displayed.
      if (index % 2 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
      frame.clearRect(0, 0, width, height)
      frame.drawImage(bitmap, index * width, 0, width, height, 0, 0, width, height)
      let pixels = frame.getImageData(0, 0, width, height)
      if (smooth) pixels = scaleFrame(pixels.data, width, height)
      if (shade) shadeSpriteFrame(pixels.data, pixels.width, pixels.height)
      output.putImageData(pixels, index * width * factor, 0)
    }
    return await encodeSheet(canvas)
  } finally {
    bitmap.close()
  }
}

function spriteVariant(source: string, width: number, height: number, count: number, smooth: boolean, shade: boolean): Promise<string | null> {
  const url = localSheetUrl(source)
  if (!url || ![width, height, count].every(value => Number.isInteger(value) && value > 0) || width * height * count > maxSheetPixels) return Promise.resolve(null)
  const key = JSON.stringify([url, width, height, count, smooth, shade])
  const cached = variants.get(key)
  const variant = cached ?? buildSheet(url, width, height, count, smooth, shade).catch(() => null)
  variants.delete(key)
  variants.set(key, variant)
  if (variants.size > maxVariants) variants.delete(variants.keys().next().value!)
  if (!cached) {
    void variant.then(result => {
      if (!result && variants.get(key) === variant) variants.delete(key)
    })
  }
  return variant
}

export function useSpriteSheet(source: () => string, width = () => 64, height = () => 56, count = () => 12) {
  const rendered = shallowRef<SpriteSheet | null>(null)
  watch([source, width, height, count, () => visualPreferences.smoothing, () => visualPreferences.celShading],
    ([url, frameWidth, frameHeight, frameCount, smoothing, celShaded], _, onCleanup) => {
      rendered.value = null
      const smooth = smoothing === 'suave'
      if (!url || (!smooth && !celShaded)) return
      let current = true
      onCleanup(() => { current = false })
      void spriteVariant(url, frameWidth, frameHeight, frameCount, smooth, celShaded).then(variant => {
        if (current && variant) rendered.value = { url: variant, celShaded }
      })
    }, { immediate: true },
  )
  return computed(() => {
    const sheet = rendered.value ?? { url: source(), celShaded: false }
    return { ...sheet, backgroundImage: `url(${JSON.stringify(sheet.url)})` }
  })
}
