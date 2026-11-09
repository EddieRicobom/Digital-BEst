import { gunzipSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
const origin = 'https://dim.digitallink.games'
const catalog = await (await fetch(`${origin}/catalog/card-catalog.json`)).json()
const cards = catalog.cards.filter(c => c.type === 'BEM' && !c.isNonDigimon && c.characters.some(x => x.stage === 0))
const templates = []
for (const card of cards) {
  const response = await fetch(origin + card.templateUrl)
  if (!response.ok) throw Error(`Template indisponível: ${card.cardName}`)
  const data = JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString())
  templates.push({ id: card.id, name: card.cardName, characters: card.characters.filter(c => c.selectable).map(c => ({ index: c.index, name: c.name, stage: c.stage, previewUrl: c.previewUrl })), evolutions: data.transformations.entries.map(({from,to,minutes,vital,trophies,battles,winRatio,adventureLevel})=>({from,to,minutes,vital,trophies,battles,winRatio,adventureLevel})) })
}
await writeFile('src/templates.json', JSON.stringify(templates))
console.log(`${templates.length} templates importados`)
