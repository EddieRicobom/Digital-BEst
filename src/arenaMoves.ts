import templates from './templates.json'

export type ArenaMovePattern = 'shot' | 'spread' | 'pierce' | 'burst' | 'slash'
export type ArenaMoveCategory = 'physical' | 'fire' | 'electric' | 'water' | 'wind' | 'light' | 'dark' | 'nature' | 'metal'

export interface ArenaMove {
  name: string
  category: ArenaMoveCategory
  pattern: ArenaMovePattern
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

const alternatives: Record<ArenaMovePattern, readonly [ArenaMovePattern, ArenaMovePattern]> = {
  shot: ['spread', 'burst'],
  spread: ['pierce', 'slash'],
  pierce: ['spread', 'burst'],
  burst: ['shot', 'slash'],
  slash: ['burst', 'shot'],
}

interface MoveTheme {
  color: string
  names: Record<ArenaMovePattern, string>
  signatureByTier: readonly [ArenaMovePattern, ArenaMovePattern, ArenaMovePattern]
}

const themes: Record<ArenaMoveCategory, MoveTheme> = {
  physical: {
    color: '#ffdf9d',
    names: { shot: 'Pulso Digital', spread: 'Rajada Tripla', pierce: 'Impacto Perfurante', burst: 'Onda de Impacto', slash: 'Golpe Relâmpago' },
    signatureByTier: ['shot', 'slash', 'burst'],
  },
  fire: {
    color: '#ff914c',
    names: { shot: 'Brasa Veloz', spread: 'Rajada de Brasas', pierce: 'Lança de Fogo', burst: 'Círculo de Chamas', slash: 'Garra Ígnea' },
    signatureByTier: ['shot', 'burst', 'pierce'],
  },
  electric: {
    color: '#ffe365',
    names: { shot: 'Pulso de Faísca', spread: 'Faíscas Bifurcadas', pierce: 'Raio Contínuo', burst: 'Campo de Descarga', slash: 'Corte Estático' },
    signatureByTier: ['spread', 'burst', 'pierce'],
  },
  water: {
    color: '#75dfff',
    names: { shot: 'Jato d’Água', spread: 'Leque de Maré', pierce: 'Coluna d’Água', burst: 'Redemoinho', slash: 'Lâmina de Espuma' },
    signatureByTier: ['shot', 'spread', 'burst'],
  },
  wind: {
    color: '#8ef5cd',
    names: { shot: 'Pulso de Vento', spread: 'Rajada Cruzada', pierce: 'Lança dos Ventos', burst: 'Vendaval', slash: 'Corte de Ar' },
    signatureByTier: ['shot', 'slash', 'spread'],
  },
  light: {
    color: '#fff1bb',
    names: { shot: 'Estilhaço de Luz', spread: 'Feixe Prismático', pierce: 'Raio Solar', burst: 'Aurora Radiante', slash: 'Lâmina Solar' },
    signatureByTier: ['shot', 'spread', 'pierce'],
  },
  dark: {
    color: '#c695ff',
    names: { shot: 'Orbe Sombrio', spread: 'Estilhaços Sombrios', pierce: 'Fenda Sombria', burst: 'Eclipse Local', slash: 'Garra Noturna' },
    signatureByTier: ['shot', 'slash', 'pierce'],
  },
  nature: {
    color: '#b0ed75',
    names: { shot: 'Semente Veloz', spread: 'Chuva de Esporos', pierce: 'Espinho Perfurante', burst: 'Onda de Pólen', slash: 'Corte de Folha' },
    signatureByTier: ['shot', 'spread', 'burst'],
  },
  metal: {
    color: '#b9d8ff',
    names: { shot: 'Projétil de Aço', spread: 'Rajada de Limalha', pierce: 'Canhão de Liga', burst: 'Onda de Estilhaços', slash: 'Lâmina de Liga' },
    signatureByTier: ['shot', 'pierce', 'burst'],
  },
}

type Signature = readonly [category: ArenaMoveCategory, pattern: ArenaMovePattern, name: string]

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
  ['loogamon', ['fire', 'shot', 'Brasa Azul']],
  ['loogarmon', ['fire', 'slash', 'Presa Azul']],
  ['soloogarmon', ['fire', 'burst', 'Círculo Azul']],
  ['helloogarmon', ['dark', 'burst', 'Pira Sombria']],
  ['fenriloogamon', ['fire', 'pierce', 'Lança de Fogo Azul']],
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

const babyNames = ['Bolha Digital', 'Trio de Bolhas', 'Salto de Espuma'] as const

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

  function move(pattern: ArenaMovePattern, moveName: string): ArenaMove {
    const stats = patternStats[pattern]
    return {
      name: moveName,
      category,
      pattern,
      power: Math.round(stats.power * (1 + growth * 0.105) * 100) / 100,
      range: Math.round(stats.range + growth * stats.rangeGrowth),
      cooldownMs: Math.round(stats.cooldownMs * (1 - growth * 0.025)),
      color: theme.color,
    }
  }

  if (rank < 2) return [move(primary, babyNames[0]), move(second, babyNames[1]), move(third, babyNames[2])]
  return [move(primary, signature?.[2] ?? theme.names[primary]), move(second, theme.names[second]), move(third, theme.names[third])]
}
