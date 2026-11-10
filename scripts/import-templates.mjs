import { gunzipSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { createSpriteStrip } from './sprite-strip.mjs'

const origin = 'https://dim.digitallink.games'
const sprites = process.argv.includes('--sprites')
const anniversary = '843b04f90bb09dbd'
const excludedDimCards = new Set([
  '8cd81dc57553f19c', // Medarot crossover.
  // These variants repeat the same characters, sprites, stats and evolution lines.
  'df97d3545522744e', // Impulse City, variant 2.
  'ca1e8db3762462e0', // Volcanic Beat, variant 2.
  '96178a42ceefc1ce', // Agumon, variant 2.
  'ff890c9b22d23cc5', // Gabumon, variant 2.
])
const noRequirement = 0xffff
const optionalBabyFrames = [3, 4, 5, 6, 7, 10, 11]
const catalogResponse = await fetch(`${origin}/catalog/card-catalog.json`)
if (!catalogResponse.ok) throw new Error('Catálogo Digital Link indisponível')
const catalog = await catalogResponse.json()
const cards = ['BEM', 'DIM'].flatMap(type => catalog.cards.filter(card =>
  card.type === type && !card.isNonDigimon && !excludedDimCards.has(card.id) && card.characters.some(c => c.selectable && c.stage === 0),
))
const ids = new Set(cards.map(card => card.id))
if (cards.length === 0 || ids.size !== cards.length || [...ids].some(id => !/^[0-9a-f]{16}$/.test(id))) {
  throw new Error('IDs de templates inválidos no catálogo')
}

function validStat(value) {
  // The unsigned 16-bit value 0xffff marks unavailable battle stats, including babies.
  return Number.isInteger(value) && value > 0 && value < noRequirement
}

function dimBabySpriteStrip(pixels, frames) {
  if (frames.length !== 5) throw new Error('Esperados cinco frames de bebê DIM')
  const paddedFrameSize = 64 * 56 * 2
  const paddedPixels = Buffer.alloc(frames.length * paddedFrameSize, Buffer.from([0xe0, 0x07]))
  const paddedFrames = frames.map(({ width, height, invalid, byteOffset, byteLength }, index) => {
    if (invalid || width !== 32 || height !== 24 || byteLength !== 32 * 24 * 2 ||
        byteOffset < 0 || byteOffset + byteLength > pixels.length) throw new Error(`Frame inválido de bebê DIM: ${index}`)
    const paddedOffset = index * paddedFrameSize
    for (let y = 0; y < height; y++) {
      const rowStart = byteOffset + y * width * 2
      const dest = paddedOffset + ((y + 32) * 64 + 16) * 2
      pixels.copy(paddedPixels, dest, rowStart, rowStart + width * 2)
    }
    return { width: 64, height: 56, byteOffset: paddedOffset, byteLength: paddedFrameSize }
  })
  // DIM babies have idle, walk, happy and sleep poses. Place them in the matching BEM slots.
  const slots = [0, 1, 2, 0, 0, 0, 0, 0, 3, 4, 0, 0]
  return createSpriteStrip(paddedPixels, slots.map(index => paddedFrames[index]), 64, 56, 12)
}

function spriteStrips(card, data, characters) {
  const { entries, packedPixels } = data.sprites
  const pixels = Buffer.from(packedPixels, 'base64')
  const strips = new Map([['egg.png', createSpriteStrip(pixels, entries.slice(2, 10), 32, 40, 8)]])
  for (const { index, stage } of characters) {
    let strip
    if (card.type === 'DIM' && stage < 2) {
      const firstFrame = 11 + index * 6
      strip = dimBabySpriteStrip(pixels, entries.slice(firstFrame, firstFrame + 5))
    } else {
      // Adult DIM and all BEM characters have 12 animation slots between the name and splash art.
      const firstFrame = card.type === 'DIM' ? 24 + (index - 2) * 14 : 55 + index * 14
      strip = createSpriteStrip(pixels, entries.slice(firstFrame, firstFrame + 12), 64, 56, 12, stage < 2 ? optionalBabyFrames : [])
    }
    strips.set(`${index}.png`, strip)
  }
  return strips
}

async function importCard(card) {
  const response = await fetch(origin + card.templateUrl)
  if (!response.ok) throw new Error(`Template indisponível: ${card.cardName}`)
  const data = JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString())
  if (data.version !== 1 || data.type !== card.type || data.checksumValid !== true) {
    throw new Error(`Template inválido: ${card.cardName}`)
  }
  const characters = card.characters.filter(c => c.selectable)
  const characterIndexes = new Set(characters.map(c => c.index))
  const stats = {}
  for (const { index, stage, attribute } of characters) {
    const row = data.characterStats.entries[index]
    if (!row || row.stage !== stage || row.attribute !== attribute) {
      throw new Error(`Personagem divergente: ${card.cardName} #${index}`)
    }
    const { ap, hp, bp } = row
    if ([ap, hp, bp].every(validStat)) stats[index] = { ap, hp, bp }
  }

  const dim = card.type === 'DIM'
  const evolutions = data.transformations.entries.filter(row => !dim || (row.to !== noRequirement && row.hours !== noRequirement)).map(row => {
    const { from, to, vital, trophies, battles, winRatio } = row
    const minutes = dim ? row.hours * 60 : row.minutes
    let adventureLevel = dim ? noRequirement : row.adventureLevel
    if (dim && (!characterIndexes.has(from) || !characterIndexes.has(to))) {
      throw new Error(`Digievolução DIM sem personagem: ${card.cardName} #${from} → #${to}`)
    }
    if (dim && data.characterStats.entries[to].unlockRequired) {
      // The expedition and DIM adventure rows both use zero-based indexes here.
      adventureLevel = data.adventures.entries.findIndex(area => area.boss === to)
    }
    if (![minutes, vital, trophies, battles, winRatio, adventureLevel].every(value => Number.isInteger(value) && value >= 0)) {
      throw new Error(`Requisito de digievolução inválido: ${card.cardName} #${from} → #${to}`)
    }
    return { from, to, minutes, vital, trophies, battles, winRatio, adventureLevel }
  })
  const template = {
    id: card.id,
    name: card.cardName,
    author: card.author,
    type: card.type,
    characters: characters.map(({ index, name, stage, previewUrl }) => ({ index, name, stage, previewUrl })),
    evolutions,
  }
  const strips = sprites && card.id !== anniversary ? spriteStrips(card, data, characters) : new Map()
  return { template, stats, strips }
}

// Prepare and validate all downloads before replacing any local catalog data or sprites.
const imports = await Promise.all(cards.map(importCard))
const templates = imports.map(({ template }) => template)
const bemStats = {}
const dimStats = {}
let spriteCount = 0
for (const { template, stats, strips } of imports) {
  const catalogStats = template.type === 'DIM' ? dimStats : bemStats
  catalogStats[template.id] = stats
  if (!strips.size) continue
  const directory = new URL(`../public/assets/sprites/${template.id}/`, import.meta.url)
  await mkdir(directory, { recursive: true })
  for (const [filename, strip] of strips) await writeFile(new URL(filename, directory), strip)
  spriteCount += strips.size
}

await writeFile(new URL('../src/templates.json', import.meta.url), JSON.stringify(templates))
await writeFile(new URL('../src/bem-stats.json', import.meta.url), `${JSON.stringify(bemStats)}\n`)
await writeFile(new URL('../src/dim-stats.json', import.meta.url), `${JSON.stringify(dimStats)}\n`)
console.log(`${templates.length} templates importados`)
for (const [type, stats] of [['BEM', bemStats], ['DIM', dimStats]]) {
  const statsCount = Object.values(stats).reduce((count, card) => count + Object.keys(card).length, 0)
  console.log(`${statsCount} conjuntos de estatísticas ${type} importados`)
}
if (sprites) console.log(`${spriteCount} tiras de sprites geradas`)
