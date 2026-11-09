import { gunzipSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { createSpriteStrip } from './sprite-strip.mjs'

const origin = 'https://dim.digitallink.games'
const sprites = process.argv.includes('--sprites')
const anniversary = '843b04f90bb09dbd'
const optionalBabyFrames = [3, 4, 5, 6, 7, 10, 11]
const catalogResponse = await fetch(`${origin}/catalog/card-catalog.json`)
if (!catalogResponse.ok) throw new Error('Catálogo Digital Link indisponível')
const catalog = await catalogResponse.json()
const cards = catalog.cards.filter(c => c.type === 'BEM' && !c.isNonDigimon && c.characters.some(x => x.stage === 0))
const templates = []
const bemStats = {}
let spriteCount = 0
let statsCount = 0

function validStat(value) {
  // The unsigned 16-bit value 0xffff marks unavailable battle stats, including babies.
  return Number.isInteger(value) && value > 0 && value < 0xffff
}

for (const card of cards) {
  const response = await fetch(origin + card.templateUrl)
  if (!response.ok) throw new Error(`Template indisponível: ${card.cardName}`)
  const data = JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString())
  const characters = card.characters.filter(c => c.selectable)
  templates.push({
    id: card.id,
    name: card.cardName,
    author: card.author,
    characters: characters.map(({ index, name, stage, previewUrl }) => ({ index, name, stage, previewUrl })),
    evolutions: data.transformations.entries.map(({ from, to, minutes, vital, trophies, battles, winRatio, adventureLevel }) => ({ from, to, minutes, vital, trophies, battles, winRatio, adventureLevel })),
  })

  if (data.version === 1 && data.type === 'BEM' && data.checksumValid === true) {
    const stats = {}
    for (const { index, stage, attribute } of characters) {
      const row = data.characterStats?.entries?.[index]
      if (!row || row.stage !== stage || row.attribute !== attribute) continue
      const { ap, hp, bp } = row
      if (![ap, hp, bp].every(validStat)) continue
      stats[index] = { ap, hp, bp }
      statsCount++
    }
    bemStats[card.id] = stats
  } else {
    console.warn(`Estatísticas indisponíveis: ${card.cardName}`)
  }

  if (!sprites || card.id === anniversary) continue
  if (data.version !== 1 || data.type !== 'BEM') throw new Error(`Formato de sprites inesperado: ${card.cardName}`)
  const { entries, packedPixels } = data.sprites
  const pixels = Buffer.from(packedPixels, 'base64')
  const directory = new URL(`../public/assets/sprites/${card.id}/`, import.meta.url)
  await mkdir(directory, { recursive: true })
  const egg = createSpriteStrip(pixels, entries.slice(2, 10), 32, 40, 8)
  await writeFile(new URL('egg.png', directory), egg)
  spriteCount++
  for (const { index, stage } of characters) {
    // Each BEM character has a name image, 12 animation frames and splash art.
    const firstFrame = 54 + index * 14 + 1
    const strip = createSpriteStrip(pixels, entries.slice(firstFrame, firstFrame + 12), 64, 56, 12, stage < 2 ? optionalBabyFrames : [])
    await writeFile(new URL(`${index}.png`, directory), strip)
    spriteCount++
  }
}
await writeFile(new URL('../src/templates.json', import.meta.url), JSON.stringify(templates))
await writeFile(new URL('../src/bem-stats.json', import.meta.url), `${JSON.stringify(bemStats)}\n`)
console.log(`${templates.length} templates importados`)
console.log(`${statsCount} conjuntos de estatísticas BEM importados`)
if (sprites) console.log(`${spriteCount} tiras de sprites geradas`)
