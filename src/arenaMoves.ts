import templates from './templates.json'

export type ArenaMovePattern = 'shot' | 'spread' | 'pierce' | 'burst' | 'slash'
export type ArenaMoveCategory = 'physical' | 'fire' | 'electric' | 'water' | 'wind' | 'light' | 'dark' | 'nature' | 'metal'

export interface ArenaMove {
  name: string
  category: ArenaMoveCategory
  pattern: ArenaMovePattern
  visual: ArenaMoveVisual
  visualLabel: string
  power: number
  range: number
  cooldownMs: number
  color: string
}

export const arenaMoveCategoryLabels: Record<ArenaMoveCategory, string> = {
  physical: 'Físico',
  fire: 'Fogo',
  electric: 'Elétrico',
  water: 'Água',
  wind: 'Vento',
  light: 'Luz',
  dark: 'Sombras',
  nature: 'Natureza',
  metal: 'Metal',
}

const patternStats = {
  shot: { power: 1.15, range: 31, rangeGrowth: 1.5, cooldownMs: 660 },
  spread: { power: 0.85, range: 27, rangeGrowth: 1.2, cooldownMs: 820 },
  pierce: { power: 1.3, range: 36, rangeGrowth: 1.5, cooldownMs: 980 },
  burst: { power: 1.5, range: 17, rangeGrowth: 0.8, cooldownMs: 1050 },
  slash: { power: 1.55, range: 13, rangeGrowth: 0.6, cooldownMs: 540 },
} satisfies Record<ArenaMovePattern, { power: number; range: number; rangeGrowth: number; cooldownMs: number }>

interface ArenaMoveStyle {
  pattern: ArenaMovePattern
  label: string
  color: string
  powerScale: number
  rangeBonus: number
  cooldownScale: number
}

export const arenaMoveStyles = {
  bubble: { pattern: 'shot', label: 'Bolha', color: '#a7e8ff', powerScale: 0.94, rangeBonus: 0, cooldownScale: 0.93 },
  fireball: { pattern: 'shot', label: 'Bola de Fogo', color: '#ff914c', powerScale: 1.09, rangeBonus: 0, cooldownScale: 1.11 },
  spark: { pattern: 'shot', label: 'Faísca', color: '#ffe365', powerScale: 0.90, rangeBonus: 1, cooldownScale: 0.91 },
  'air-orb': { pattern: 'shot', label: 'Esfera de Ar', color: '#8ef5cd', powerScale: 0.96, rangeBonus: 3, cooldownScale: 1.02 },
  seed: { pattern: 'shot', label: 'Semente', color: '#b0ed75', powerScale: 1.02, rangeBonus: -2, cooldownScale: 0.97 },
  'steel-orb': { pattern: 'shot', label: 'Esfera de Aço', color: '#bacbe5', powerScale: 1.12, rangeBonus: -2, cooldownScale: 1.08 },

  'ember-fan': { pattern: 'spread', label: 'Leque de Brasas', color: '#ffad54', powerScale: 1.09, rangeBonus: -1, cooldownScale: 1.08 },
  'chain-sparks': { pattern: 'spread', label: 'Centelhas Bifurcadas', color: '#fff17e', powerScale: 0.94, rangeBonus: 1, cooldownScale: 0.94 },
  'tidal-fan': { pattern: 'spread', label: 'Leque de Maré', color: '#75dfff', powerScale: 1.02, rangeBonus: -1, cooldownScale: 0.98 },
  'feather-volley': { pattern: 'spread', label: 'Salva Flutuante', color: '#b0f9dc', powerScale: 0.91, rangeBonus: 3, cooldownScale: 0.97 },
  'prism-fan': { pattern: 'spread', label: 'Leque Prismático', color: '#fff1bb', powerScale: 1.05, rangeBonus: 2, cooldownScale: 1.10 },
  'shard-volley': { pattern: 'spread', label: 'Salva de Estilhaços', color: '#aec7f5', powerScale: 1.12, rangeBonus: -3, cooldownScale: 1.06 },

  'flame-lance': { pattern: 'pierce', label: 'Lança de Fogo', color: '#ff805f', powerScale: 1.08, rangeBonus: -1, cooldownScale: 1.05 },
  'plasma-beam': { pattern: 'pierce', label: 'Feixe de Plasma', color: '#ffe776', powerScale: 1.04, rangeBonus: 0, cooldownScale: 1.01 },
  'ice-spear': { pattern: 'pierce', label: 'Lança Elemental', color: '#94e9ff', powerScale: 0.94, rangeBonus: 2, cooldownScale: 0.98 },
  sunbeam: { pattern: 'pierce', label: 'Raio Solar', color: '#ffed9b', powerScale: 1.10, rangeBonus: 2, cooldownScale: 1.13 },
  'void-rift': { pattern: 'pierce', label: 'Fenda do Vazio', color: '#c996ff', powerScale: 1.13, rangeBonus: -4, cooldownScale: 1.08 },
  'rail-shot': { pattern: 'pierce', label: 'Disparo de Trilho', color: '#b9d8ff', powerScale: 0.98, rangeBonus: 4, cooldownScale: 1.06 },

  shockwave: { pattern: 'burst', label: 'Onda de Choque', color: '#ffdf9d', powerScale: 1, rangeBonus: 0, cooldownScale: 1 },
  eruption: { pattern: 'burst', label: 'Erupção', color: '#ff7d55', powerScale: 1.10, rangeBonus: -1, cooldownScale: 1.08 },
  'thunder-field': { pattern: 'burst', label: 'Campo de Raios', color: '#ffdb61', powerScale: 1.04, rangeBonus: 2, cooldownScale: 1.10 },
  whirlpool: { pattern: 'burst', label: 'Redemoinho', color: '#6fdff4', powerScale: 0.96, rangeBonus: 1, cooldownScale: 1.02 },
  'solar-halo': { pattern: 'burst', label: 'Halo Radiante', color: '#ffe9ad', powerScale: 0.91, rangeBonus: 3, cooldownScale: 1.01 },
  eclipse: { pattern: 'burst', label: 'Eclipse', color: '#b380ff', powerScale: 1.13, rangeBonus: -3, cooldownScale: 1.09 },

  claw: { pattern: 'slash', label: 'Garra', color: '#ffd99f', powerScale: 0.95, rangeBonus: 0, cooldownScale: 0.94 },
  'flame-claw': { pattern: 'slash', label: 'Garra de Fogo', color: '#ffa16e', powerScale: 1.08, rangeBonus: -1, cooldownScale: 1.05 },
  'thunder-fist': { pattern: 'slash', label: 'Punho Elétrico', color: '#ffdc75', powerScale: 1.13, rangeBonus: -2, cooldownScale: 1.08 },
  crescent: { pattern: 'slash', label: 'Arco Crescente', color: '#a7edf9', powerScale: 1.01, rangeBonus: 1, cooldownScale: 1.06 },
  'thorn-whip': { pattern: 'slash', label: 'Chicote de Espinhos', color: '#c2f184', powerScale: 0.92, rangeBonus: 3, cooldownScale: 1.04 },
  'twin-blade': { pattern: 'slash', label: 'Lâminas Gêmeas', color: '#d7e6ff', powerScale: 1.04, rangeBonus: 0, cooldownScale: 1.02 },
} as const satisfies Record<string, ArenaMoveStyle>

export type ArenaMoveVisual = keyof typeof arenaMoveStyles
type VisualFor<Pattern extends ArenaMovePattern> = {
  [Visual in ArenaMoveVisual]: typeof arenaMoveStyles[Visual]['pattern'] extends Pattern ? Visual : never
}[ArenaMoveVisual]

const alternatives: Record<ArenaMovePattern, readonly [ArenaMovePattern, ArenaMovePattern]> = {
  shot: ['spread', 'burst'],
  spread: ['pierce', 'slash'],
  pierce: ['spread', 'burst'],
  burst: ['shot', 'slash'],
  slash: ['burst', 'shot'],
}

interface MoveTheme {
  moves: { [Pattern in ArenaMovePattern]: readonly [visual: VisualFor<Pattern>, name: string, tint?: string] }
  signatureByTier: readonly [ArenaMovePattern, ArenaMovePattern, ArenaMovePattern]
}

const themes: Record<ArenaMoveCategory, MoveTheme> = {
  physical: {
    moves: {
      shot: ['bubble', 'Pulso Digital', '#ffdf9d'],
      spread: ['shard-volley', 'Rajada Tripla', '#ffd6a4'],
      pierce: ['rail-shot', 'Impacto Perfurante', '#ffcc86'],
      burst: ['shockwave', 'Onda de Impacto'],
      slash: ['claw', 'Golpe Relâmpago'],
    },
    signatureByTier: ['shot', 'slash', 'burst'],
  },
  fire: {
    moves: {
      shot: ['fireball', 'Brasa Veloz'],
      spread: ['ember-fan', 'Rajada de Brasas'],
      pierce: ['flame-lance', 'Lança de Fogo'],
      burst: ['eruption', 'Círculo de Chamas'],
      slash: ['flame-claw', 'Garra Ígnea'],
    },
    signatureByTier: ['shot', 'burst', 'pierce'],
  },
  electric: {
    moves: {
      shot: ['spark', 'Pulso de Faísca'],
      spread: ['chain-sparks', 'Faíscas Bifurcadas'],
      pierce: ['plasma-beam', 'Raio Contínuo'],
      burst: ['thunder-field', 'Campo de Descarga'],
      slash: ['thunder-fist', 'Punho Estático'],
    },
    signatureByTier: ['spread', 'burst', 'pierce'],
  },
  water: {
    moves: {
      shot: ['bubble', 'Esfera d’Água'],
      spread: ['tidal-fan', 'Leque de Maré'],
      pierce: ['ice-spear', 'Coluna de Gelo'],
      burst: ['whirlpool', 'Redemoinho'],
      slash: ['crescent', 'Lâmina de Espuma'],
    },
    signatureByTier: ['shot', 'spread', 'burst'],
  },
  wind: {
    moves: {
      shot: ['air-orb', 'Pulso de Vento'],
      spread: ['feather-volley', 'Rajada Cruzada'],
      pierce: ['ice-spear', 'Lança dos Ventos', '#8ef5cd'],
      burst: ['shockwave', 'Vendaval', '#a4f3d8'],
      slash: ['crescent', 'Corte de Ar', '#a3f7c1'],
    },
    signatureByTier: ['shot', 'slash', 'spread'],
  },
  light: {
    moves: {
      shot: ['spark', 'Estilhaço de Luz', '#fff5cb'],
      spread: ['prism-fan', 'Rajada Prismática'],
      pierce: ['sunbeam', 'Raio Solar'],
      burst: ['solar-halo', 'Aurora Radiante'],
      slash: ['twin-blade', 'Lâminas Solares', '#fff0af'],
    },
    signatureByTier: ['shot', 'spread', 'pierce'],
  },
  dark: {
    moves: {
      shot: ['fireball', 'Orbe Sombrio', '#cc99ff'],
      spread: ['shard-volley', 'Estilhaços Sombrios', '#bf9aff'],
      pierce: ['void-rift', 'Fenda Sombria'],
      burst: ['eclipse', 'Eclipse Local'],
      slash: ['claw', 'Garra Noturna', '#cb90ff'],
    },
    signatureByTier: ['shot', 'slash', 'pierce'],
  },
  nature: {
    moves: {
      shot: ['seed', 'Semente Veloz'],
      spread: ['feather-volley', 'Chuva de Pétalas', '#d1f08b'],
      pierce: ['ice-spear', 'Espinho Perfurante', '#acf086'],
      burst: ['solar-halo', 'Onda de Pólen', '#d9f48a'],
      slash: ['thorn-whip', 'Chicote de Folhas'],
    },
    signatureByTier: ['shot', 'spread', 'burst'],
  },
  metal: {
    moves: {
      shot: ['steel-orb', 'Projétil de Aço'],
      spread: ['shard-volley', 'Rajada de Limalha'],
      pierce: ['rail-shot', 'Canhão de Liga'],
      burst: ['shockwave', 'Onda de Estilhaços', '#b8d9ff'],
      slash: ['twin-blade', 'Lâminas de Liga'],
    },
    signatureByTier: ['shot', 'pierce', 'burst'],
  },
}

type Signature = readonly [category: ArenaMoveCategory, pattern: ArenaMovePattern, name: string, tint?: string]

// Os nomes e padrões abaixo são adaptações criadas para a arena.
const signatures = new Map<string, Signature>([
  ['agumon', ['fire', 'shot', 'Bafo de Brasa']],
  ['agumon (2006)', ['fire', 'shot', 'Brasa Incandescente']],
  ['agumon (black)', ['dark', 'shot', 'Chama Escura']],
  ['greymon', ['fire', 'burst', 'Erupção Dracônica']],
  ['metal greymon (virus)', ['metal', 'spread', 'Salva Mecânica']],
  ['blitz greymon', ['electric', 'pierce', 'Canhão de Plasma']],
  ['betamon', ['electric', 'spread', 'Faísca Anfíbia']],
  ['seadramon', ['water', 'pierce', 'Jato Glacial']],
  ['tyranomon', ['fire', 'shot', 'Chama Fóssil']],
  ['meramon', ['fire', 'burst', 'Pira Viva']],
  ['devimon', ['dark', 'slash', 'Garra do Abismo']],
  ['pulsemon', ['electric', 'spread', 'Centelhas em Série']],
  ['bulkmon', ['electric', 'burst', 'Impacto Eletrostático']],
  ['boutmon', ['electric', 'slash', 'Punho de Trovão']],
  ['kazuchimon', ['electric', 'pierce', 'Lança Trovejante']],
  ['fenriloogamon: takemikazuchi', ['electric', 'burst', 'Tormenta de Plasma']],
  ['gammamon', ['physical', 'shot', 'Faísca Estelar']],
  ['betel gammamon', ['fire', 'slash', 'Garra de Cometa']],
  ['kaus gammamon', ['wind', 'spread', 'Rajada Orbital']],
  ['wezen gammamon', ['metal', 'pierce', 'Canhão de Cerco']],
  ['gulus gammamon', ['dark', 'slash', 'Garra de Vácuo']],
  ['canoweissmon', ['light', 'burst', 'Explosão Estelar']],
  ['regulusmon', ['dark', 'pierce', 'Feixe da Penumbra']],
  ['siriusmon', ['light', 'spread', 'Duelo Prismático']],
  ['arcturusmon', ['dark', 'burst', 'Abalo do Vazio']],
  ['proximamon', ['light', 'pierce', 'Feixe do Horizonte']],
  ['angoramon', ['wind', 'burst', 'Giro de Brisa']],
  ['symbare angoramon', ['wind', 'slash', 'Corte Bailarino']],
  ['lamortmon', ['physical', 'slash', 'Garras Crescentes']],
  ['diarbbitmon', ['light', 'slash', 'Estocada Geminada']],
  ['dracumon', ['dark', 'spread', 'Agulhas da Noite']],
  ['jellymon', ['electric', 'shot', 'Faísca Gelatinosa']],
  ['tesla jellymon', ['electric', 'slash', 'Choque Espiral']],
  ['thetismon', ['water', 'burst', 'Espiral de Espuma']],
  ['amphimon', ['electric', 'pierce', 'Hidrorraio']],
  ['ikkakumon', ['water', 'shot', 'Dardo de Geada']],
  ['zudomon', ['electric', 'burst', 'Martelo da Tempestade']],
  ['vikemon', ['water', 'burst', 'Maré Congelante']],
  ['v-mon', ['physical', 'slash', 'Cabeçada Veloz']],
  ['xv-mon', ['light', 'spread', 'Rajada em Cruz']],
  ['wormmon', ['nature', 'shot', 'Fio Pegajoso']],
  ['stingmon', ['nature', 'slash', 'Ferrão Veloz']],
  ['paildramon', ['metal', 'spread', 'Salva Gêmea']],
  ['dinobeemon', ['wind', 'slash', 'Garras em Mergulho']],
  ['imperialdramon: dragon mode', ['metal', 'pierce', 'Canhão Dracônico']],
  ['imperialdramon: fighter mode', ['light', 'pierce', 'Disparo Imperial']],
  ['imperialdramon: paladin mode', ['light', 'slash', 'Corte do Paladino']],
  ['geo greymon', ['fire', 'burst', 'Labareda Solar']],
  ['rize greymon', ['metal', 'pierce', 'Disparo de Cerco']],
  ['shine greymon', ['light', 'burst', 'Clarão de Fornalha']],
  ['shine greymon: burst mode', ['fire', 'slash', 'Espada da Coroa Solar']],
  ['dracomon', ['fire', 'shot', 'Sopro Dracônico']],
  ['hackmon', ['metal', 'slash', 'Garra Temperada']],
  ['jesmon', ['light', 'slash', 'Lâmina Guardiã']],
  ['examon', ['metal', 'pierce', 'Lança Dracônica']],
  ['gaomon', ['physical', 'slash', 'Punho Veloz']],
  ['gaogamon', ['wind', 'spread', 'Uivo Cortante']],
  ['mach gaogamon', ['wind', 'pierce', 'Jato de Pressão']],
  ['mirage gaogamon', ['light', 'burst', 'Clarão da Miragem']],
  ['mirage gaogamon: burst mode', ['light', 'slash', 'Arco da Miragem']],
  ['coronamon', ['fire', 'shot', 'Brasa Solar']],
  ['firamon', ['fire', 'slash', 'Garra Solar']],
  ['flaremon', ['fire', 'spread', 'Juba Incandescente']],
  ['apollomon', ['fire', 'burst', 'Coroa de Fogo']],
  ['lunamon', ['water', 'shot', 'Gota Lunar']],
  ['lekismon', ['water', 'spread', 'Salva Lunar']],
  ['crescemon', ['water', 'slash', 'Lâmina Crescente']],
  ['dianamon', ['light', 'pierce', 'Feixe da Lua Cheia']],
  ['grace novamon', ['light', 'burst', 'Conjunção Celeste']],
  ['loogamon', ['fire', 'shot', 'Brasa Azul', '#6ab8ff']],
  ['loogarmon', ['fire', 'slash', 'Presa Azul', '#72c6ff']],
  ['soloogarmon', ['fire', 'burst', 'Círculo Azul', '#65acff']],
  ['helloogarmon', ['dark', 'burst', 'Pira Sombria']],
  ['fenriloogamon', ['fire', 'pierce', 'Lança de Fogo Azul', '#90b9ff']],
  ['herissmon', ['electric', 'spread', 'Salva de Espinhos']],
  ['filmon', ['electric', 'slash', 'Garra de Faísca']],
  ['stiffilmon', ['electric', 'pierce', 'Espinho Condutor']],
  ['rasenmon', ['electric', 'burst', 'Espiral de Raios']],
  ['piyomon', ['wind', 'shot', 'Pena Veloz']],
  ['birdramon', ['fire', 'spread', 'Penas de Brasa']],
  ['garudamon', ['fire', 'slash', 'Garra do Poente']],
  ['hououmon', ['light', 'burst', 'Aurora da Fênix']],
  ['luxmon', ['light', 'shot', 'Centelha Radiante']],
  ['falcomon (2006)', ['wind', 'spread', 'Penas Cruzadas']],
  ['ravmon', ['wind', 'slash', 'Corte da Asa']],
  ['shakamon', ['light', 'burst', 'Onda Serena']],
  ['tentomon', ['electric', 'shot', 'Estalo Elétrico']],
  ['kabuterimon', ['electric', 'pierce', 'Feixe do Besouro']],
  ['lalamon', ['nature', 'shot', 'Semente Saltitante']],
  ['sunflowmon', ['nature', 'spread', 'Salva de Sementes']],
  ['lilamon', ['nature', 'pierce', 'Raio de Pétalas']],
  ['rosemon', ['nature', 'slash', 'Chicote de Espinhos']],
  ['funbeemon', ['nature', 'spread', 'Ferrões Triplos']],
  ['armadimon', ['physical', 'slash', 'Pancada de Carapaça']],
  ['ankylomon', ['physical', 'burst', 'Abalo Blindado']],
  ['patamon', ['wind', 'shot', 'Bola de Ar']],
  ['angemon', ['light', 'pierce', 'Coluna Luminosa']],
  ['seraphimon', ['light', 'burst', 'Círculo Celeste']],
  ['hawkmon', ['wind', 'spread', 'Penas Cortantes']],
  ['aquilamon', ['wind', 'pierce', 'Mergulho de Vendaval']],
  ['tailmon (child)', ['light', 'shot', 'Lampejo Felino']],
  ['tailmon', ['light', 'slash', 'Garra Radiante']],
  ['angewomon', ['light', 'pierce', 'Flecha Radiante']],
  ['ryudamon', ['metal', 'shot', 'Dardo Temperado']],
  ['ginryumon', ['metal', 'slash', 'Corte Prateado']],
  ['hisyaryumon', ['metal', 'spread', 'Lâminas em Leque']],
  ['ouryumon', ['metal', 'slash', 'Espadas Cruzadas']],
  ['alphamon: ouryuken', ['light', 'slash', 'Corte do Alvorecer']],
  ['commandramon', ['metal', 'spread', 'Rajada Tática']],
  ['dorumon', ['metal', 'shot', 'Esfera de Ferro']],
  ['dorugamon', ['metal', 'burst', 'Estilhaço Dracônico']],
  ['doruguremon', ['metal', 'pierce', 'Investida de Ferro']],
  ['dorugoramon', ['metal', 'spread', 'Salva Dracônica']],
  ['alphamon', ['light', 'pierce', 'Estocada do Alvorecer']],
  ['death-x-dorugamon', ['dark', 'burst', 'Estilhaço do Vazio']],
  ['death-x-doruguremon', ['dark', 'pierce', 'Investida Sombria']],
  ['death-x-dorugoramon', ['dark', 'spread', 'Salva da Ruína']],
])

const lineThemes = new Map<string, ArenaMoveCategory>([
  ['843b04f90bb09dbd', 'physical'], // 25th Anniversary
  ['c8dacdf5b84f7f33', 'physical'], // Gammamon
  ['5fe3edb70dd57537', 'wind'], // Angoramon
  ['2704968a7410c870', 'water'], // Jellymon
  ['2116391691469466', 'light'], // Imperialdramon
  ['a7be1498234b5780', 'fire'], // Draconic Blaze
  ['b281b5ccb29082e6', 'physical'], // Rampage of the Beast
  ['0184eb5b1a8cf8bd', 'dark'], // Loogamon
  ['46a19fad74b7c2da', 'wind'], // Holy Wings
  ['418f9f70e6dc6900', 'nature'], // Forest Guardian
  ['3087c980ed374ea7', 'light'], // D-3 White and Yellow
  ['898c8792d6ba0afc', 'wind'], // D-3 White and Red
  ['79d86bd96bad49ee', 'metal'], // Ryudamon
  ['c56cb48ecc106463', 'metal'], // DORUmon
  ['25bf1590b59892d9', 'electric'], // Pulsemon
  ['d70ac942423445cb', 'electric'], // Impulse City
  ['1e4a8117e0716bb8', 'physical'], // Titan of Dust
  ['257a3667ab644edc', 'water'], // Infinite Tide
  ['9f05503d4519d2bf', 'nature'], // Hermit in the Jungle
  ['219bfa41a92f1b68', 'physical'], // Primeval Warriors
  ['c5ac9f9f73c10cc8', 'metal'], // Nu Metal Empire
  ['ffffde3475e68d8e', 'fire'], // Agnimon
  ['7719cb9f0472f46e', 'light'], // Ancient Warriors
  ['cf31dbd5ba2e2fab', 'fire'], // Volcanic Beat
  ['4cbdb04fbdabc012', 'water'], // Blizzard Fang
  ['ad95fda80f528ee8', 'wind'], // Fairimon
  ['f7145462dc99873a', 'dark'], // Dynasty of the Evil
  ['04c5dc576a34887b', 'fire'], // Agumon
  ['5e133fc75fc90377', 'water'], // Gabumon
  ['c2deb1a0cab9a317', 'dark'], // Black Roar
  ['452429f92f4340dd', 'dark'], // Shadow Howl
  ['8160a04f17b7e759', 'water'], // Chackmon
  ['23d5bc7093090fc5', 'fire'], // Guilmon
  ['b8a262b73a584fa2', 'wind'], // Terriermon
  ['3b1fa4b95b44522a', 'fire'], // Guilmon GP
  ['7308c7c53e319e16', 'dark'], // Impmon GP
  ['76654e31ca42bf29', 'light'], // Renamon GP
  ['61dc98223a239774', 'physical'], // Monodramon GP
  ['71d934894bc14275', 'physical'], // Gammamon
  ['90a7d336bf372d07', 'wind'], // Angoramon
  ['b82d9b0714176b6d', 'electric'], // Jellymon
  ['a0a7b19bf3b1942f', 'dark'], // Mad Black Roar
  ['105d38e36850bc50', 'dark'], // True Shadow Howl
  ['1e3d351741498806', 'wind'], // Wolf Howl
  ['ebec1fb5584f9ccc', 'light'], // Renamon
  ['10ab04bac23563d0', 'dark'], // Louwemon
  ['31001a50869242bd', 'metal'], // Ryudamon
  ['1ca8de5d673eacf6', 'metal'], // Espimon
  ['2661974b34f571f5', 'light'], // Wolfmon
  ['a5735c0f13f86ae3', 'electric'], // Blitzmon
])

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

const catalogPartners = new Map<string, { stage: number; templateId: string }>()
for (const template of templates) {
  for (const character of template.characters) {
    const name = normalizeName(character.name)
    if (!catalogPartners.has(name)) {
      catalogPartners.set(name, { stage: character.stage, templateId: template.id })
    }
  }
}

const babyMoves = {
  shot: ['bubble', 'Bolha Digital'],
  spread: ['tidal-fan', 'Trio de Bolhas'],
  burst: ['whirlpool', 'Salto de Espuma'],
} as const satisfies Pick<MoveTheme['moves'], 'shot' | 'spread' | 'burst'>

export function arenaMoves(partner: string, stage?: number, templateId?: string): readonly [ArenaMove, ArenaMove, ArenaMove] {
  const name = normalizeName(partner)
  const catalogPartner = catalogPartners.get(name)
  const rank = stage !== undefined && Number.isInteger(stage) && stage >= 0 && stage <= 6
    ? stage
    : catalogPartner?.stage ?? 2
  const signature = rank >= 2 ? signatures.get(name) : undefined
  const lineCategory = lineThemes.get(templateId ?? '') ?? lineThemes.get(catalogPartner?.templateId ?? '')
  const category = rank < 2 ? 'physical' : signature?.[0] ?? lineCategory ?? 'physical'
  const theme = themes[category]
  const tier = rank <= 2 ? 0 : rank === 3 ? 1 : 2
  const primary = signature?.[1] ?? theme.signatureByTier[tier]
  const [second, third] = alternatives[primary]
  const growth = rank - 2

  function move(definition: MoveTheme['moves'][ArenaMovePattern], moveName?: string, colorOverride?: string): ArenaMove {
    const [visual, defaultName, tint] = definition
    const style = arenaMoveStyles[visual]
    const { pattern } = style
    const stats = patternStats[pattern]
    return {
      name: moveName ?? defaultName,
      category,
      pattern,
      visual,
      visualLabel: style.label,
      power: Math.round(stats.power * style.powerScale * (1 + growth * 0.105) * 100) / 100,
      range: Math.round(stats.range + style.rangeBonus + growth * stats.rangeGrowth),
      cooldownMs: Math.round(stats.cooldownMs * style.cooldownScale * (1 - growth * 0.025)),
      color: colorOverride ?? tint ?? style.color,
    }
  }

  if (rank < 2) return [move(babyMoves.shot), move(babyMoves.spread), move(babyMoves.burst)]
  return [move(theme.moves[primary], signature?.[2], signature?.[3]), move(theme.moves[second]), move(theme.moves[third])]
}
