import { writeFile } from 'node:fs/promises'
import { createSpriteStrip } from './sprite-strip.mjs'
const id = 'Qie1bpWEWBvBmrE3dvFV'
const response = await fetch(`https://dim.digitallink.games/api/sprites/${id}/data`)
if (!response.ok) throw new Error(`Sprite indisponível: ${response.status}`)
const { sprite, frames } = await response.json()
if (sprite.frameWidth !== 64 || sprite.frameHeight !== 56 || frames.length !== 12) throw new Error('Formato inesperado')
const chunks = frames.map(frame => Buffer.from(frame.pixelData, 'base64'))
let offset = 0
const entries = frames.map((frame, index) => { const entry = { width: frame.width, height: frame.height, byteOffset: offset, byteLength: chunks[index].length }; offset += entry.byteLength; return entry })
await writeFile(new URL('../public/assets/sprites/enemy-greymon.png', import.meta.url), createSpriteStrip(Buffer.concat(chunks), entries, 64, 56, 12))
console.log(`Sprite ${sprite.name} por ${sprite.author}, Digital Link`)
