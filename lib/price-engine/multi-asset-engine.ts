/**
 * MULTI-ASSET OTC ENGINE - Realistic Market Phases
 * 
 * Market phases that cycle naturally:
 *  - UPTREND:       gradual climb, higher highs
 *  - DOWNTREND:     gradual drop, lower lows
 *  - CONSOLIDATION: tight range, small moves
 * 
 * Each phase lasts 15-45 seconds, with smooth blending between them.
 * Deterministic: same timestamp always produces the same price.
 */

import { hasRealPrice, getRealPrice, getRealCandles, type RealCandle } from "./real-price-store"

export interface OTCCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface OTCAsset {
  symbol: string
  name: string
  basePrice: number
  pipSize: number
  volatility: number
  icon: string
  decimals: number
}

// =============================================
// MANIPULACAO (admin) - forca a direcao dos candles
// =============================================
// Uma manipulacao aplica um "drift" direcional deterministico sobre o preco de um ativo
// durante uma janela [startTime, endTime]. Como getLivePrice e usado tanto pelo grafico
// (cliente) quanto pela liquidacao das operacoes, forcar a direcao aqui afeta o que o
// usuario VE e o resultado que ele RECEBE de forma consistente.
// Estilo de manipulacao: define COMO os candles se comportam dentro da tendencia forcada.
// O objetivo e parecer um grafico real (candles mistos, pullbacks, pavios) mesmo estando
// sendo manipulado — em vez de uma rampa reta so subindo/descendo.
export type ManipulationStyle = "natural" | "suave" | "forte" | "volatil"

export interface Manipulation {
  symbol: string
  direction: "up" | "down"
  startTime: number // unix seconds
  endTime: number // unix seconds
  strength: number // 0..100
  style?: ManipulationStyle
}

// A ESCALA e o que fazia a manipulacao parecer falsa. Ela era medida em "bandas naturais" —
// a banda e a faixa que o preco percorre em ~50 minutos, entao uma janela de 5 min deslocava
// o equivalente a 20 velas de uma vez e desenhava um candle vertical no grafico.
//
// Medindo o motor natural, a vela de 1 minuto tem range mediano de ~6,8% da banda. Agora tudo
// e expresso NESSA unidade (a vela normal do ativo), o que mantem a manipulacao no mesmo
// tamanho visual do resto do grafico em qualquer ativo.
const NATURAL_CANDLE = 0.068

// Perfis de comportamento. A manipulacao NAO e uma rampa: e um CAMINHO com pernas
// (avanco -> pullback -> avanco -> ...), como uma tendencia de verdade. Os parametros definem
// o "temperamento" desse caminho:
// - pace:     velocidade da tendencia, em velas normais de deslocamento liquido por MINUTO.
//             0.5 = ao fim de cada minuto o preco avancou meia vela na direcao forcada.
// - retrace:  profundidade dos pullbacks como fracao da perna anterior (0.9 = devolve quase tudo).
// - fake:     probabilidade de comecar com um movimento CONTRA a direcao (armadilha inicial).
// - legs:     quantas pernas de avanco o caminho tem (mais pernas = mais zigue-zague).
// - wick:     ruido rapido sobreposto, em fracao da vela normal -> pavios e candles de cor mista.
const STYLE_PROFILES: Record<
  ManipulationStyle,
  { pace: number; retrace: number; fake: number; minLegs: number; maxLegs: number; wick: number }
> = {
  // sobe/desce de forma limpa, com respiros curtos
  suave: { pace: 0.34, retrace: 0.45, fake: 0.2, minLegs: 3, maxLegs: 4, wick: 0.12 },
  // tendencia com pullbacks de verdade e armadilha inicial frequente (padrao)
  natural: { pace: 0.46, retrace: 0.72, fake: 0.55, minLegs: 4, maxLegs: 5, wick: 0.22 },
  // direcional firme: pullbacks rasos, chegada decidida
  forte: { pace: 0.72, retrace: 0.5, fake: 0.35, minLegs: 3, maxLegs: 5, wick: 0.15 },
  // chicoteia muito antes de entregar a direcao
  volatil: { pace: 0.5, retrace: 0.9, fake: 0.72, minLegs: 5, maxLegs: 7, wick: 0.38 },
}

let activeManipulations: Manipulation[] = []

export function setManipulations(list: Manipulation[]) {
  activeManipulations = Array.isArray(list) ? list : []
}

export function getManipulations(): Manipulation[] {
  return activeManipulations
}

// -----------------------------------------------------------------------------
// CAMINHO DA MANIPULACAO
// -----------------------------------------------------------------------------
// O problema do modelo antigo: o preco andava sempre para o mesmo lado, do inicio ao fim.
// Uma manipulacao de ALTA sem nenhum candle de baixa e obvia — qualquer usuario percebe.
//
// Aqui o percurso e montado como um mercado real: pernas de avanco intercaladas com pullbacks
// (que podem levar o preco ABAIXO de onde a manipulacao comecou, inclusive numa manipulacao de
// alta), e so no ultimo trecho o movimento vira firme e monotono na direcao forcada. O valor no
// fim da janela e SEMPRE 1 (deslocamento total na direcao), entao o resultado das operacoes que
// expiram no fechamento continua garantido.
//
// O desenho e sorteado a partir do startTime: duas manipulacoes iguais nunca tracam o mesmo
// caminho, mas cada uma e deterministica — o grafico nao se redesenha e a liquidacao no servidor
// recalcula exatamente o mesmo preco.
type ManipPath = { ps: number[]; vs: number[] }

const pathCache = new Map<string, ManipPath>()

function buildManipPath(seed: number, prof: (typeof STYLE_PROFILES)["natural"], strength: number): ManipPath {
  const r = (k: number) => srand(seed * 0.061 + k * 7.13)

  const legs = prof.minLegs + Math.floor(r(1) * (prof.maxLegs - prof.minLegs + 0.999))

  // Armadilha inicial: o preco anda CONTRA a direcao forcada antes de virar. E o que faz a
  // manipulacao de alta ter um fundo antes de subir.
  const raw: number[] = [0]
  let v = 0
  if (r(2) < prof.fake) {
    v = -(0.2 + 0.5 * r(3)) * (1.15 - 0.35 * strength)
    raw.push(v)
  }

  for (let i = 0; i < legs; i++) {
    const isLast = i === legs - 1
    // A ultima perna e a mais decidida: e ela que confirma a direcao e fecha a janela.
    const adv = (isLast ? 1.2 : 0.5) + 0.9 * r(10 + i)
    v += adv
    raw.push(v)

    if (!isLast) {
      // Pullbacks ficam mais rasos conforme a janela avanca -> convergencia natural no fim.
      const lateness = (i + 1) / legs
      const depth = prof.retrace * (0.35 + 0.85 * r(30 + i)) * (1 - 0.55 * lateness)
      v -= adv * Math.min(0.95, depth)
      raw.push(v)
    }
  }

  // Duracao de cada trecho ~ proporcional ao tamanho do movimento, com folga aleatoria. Isso
  // mantem a VELOCIDADE do preco parecida em todo o percurso: sem isso a ultima perna (a maior)
  // acontecia no mesmo tempo das outras e virava um candle vertical no fim da janela.
  const n = raw.length - 1
  const ps = [0]
  const durs: number[] = []
  let tot = 0
  for (let i = 0; i < n; i++) {
    const d = (0.3 + Math.abs(raw[i + 1] - raw[i])) * (0.7 + 0.6 * r(60 + i))
    durs.push(d)
    tot += d
  }
  let acc = 0
  for (let i = 0; i < n; i++) {
    acc += durs[i] / tot
    ps.push(Math.min(1, acc))
  }

  // Normaliza para que o fim da janela seja exatamente 1 (deslocamento total na direcao).
  const last = raw[raw.length - 1] || 1
  return { ps, vs: raw.map((x) => x / last) }
}

function shapeAt(path: ManipPath, p: number): number {
  const { ps, vs } = path
  if (p <= 0) return 0
  if (p >= 1) return vs[vs.length - 1]
  for (let i = 1; i < ps.length; i++) {
    if (p <= ps[i]) {
      const seg = Math.max(1e-6, ps[i] - ps[i - 1])
      const t = (p - ps[i - 1]) / seg
      const u = t * t * (3 - 2 * t) // smoothstep: sem "bicos" nas viradas
      return vs[i - 1] * (1 - u) + vs[i] * u
    }
  }
  return vs[vs.length - 1]
}

// Parte LENTA do movimento natural (oitavas de 2,5 min ou mais). Ela concentra ~90% da amplitude
// do preco e pode andar mais de 180 pips em 5 minutos — o suficiente para anular a manipulacao e
// fazer a operacao perder mesmo com a direcao forcada. Durante a janela essa parte fica
// neutralizada, entao quem decide o rumo e apenas o caminho controlado.
// As oitavas rapidas continuam intactas: sao elas que produzem quase todo o range da vela de 1
// minuto (54 dos 60 pips medianos), ou seja, a textura do grafico nao muda.
function slowNaturalDev(symSeed: number, timestamp: number): number {
  let dev = 0
  for (let i = 0; i < PRICE_OCTAVES.length; i++) {
    const { period, amp } = PRICE_OCTAVES[i]
    if (period < 150) continue
    dev += valueNoise(timestamp / period + i * 137.5 + symSeed, symSeed + i) * amp
  }
  return dev / PRICE_OCTAVE_TOTAL
}

// Retorna o deslocamento de preco a aplicar para um ativo em um dado timestamp.
// = caminho direcional (pernas + pullbacks) + ruido rapido (pavios/cor mista).
function manipulationDrift(asset: OTCAsset, timestamp: number): number {
  if (!activeManipulations.length) return 0

  // Mesma "banda" natural usada em getLivePrice, para o movimento ficar na escala do ativo.
  const bandPct = 0.004 + (asset.volatility / 100) * 0.012
  const band = asset.basePrice * bandPct
  const symSeed = asset.basePrice * 13.37

  let drift = 0
  for (let i = 0; i < activeManipulations.length; i++) {
    const m = activeManipulations[i]
    if (m.symbol !== asset.symbol) continue

    const duration = Math.max(1, m.endTime - m.startTime)
    // Cauda de liberacao: ao terminar, o deslocamento se dissolve aos poucos em vez de o preco
    // dar um salto de volta ao normal (o salto era a pista mais obvia de manipulacao).
    // A liberacao dura o MESMO tempo que a manipulacao, para o preco voltar ao normal na mesma
    // velocidade com que subiu — parece um pullback comum. Com uma cauda curta (o que havia
    // antes), todo o deslocamento era devolvido em um minuto e criava justamente o candle
    // gigante que denunciava a manipulacao.
    const release = Math.min(900, Math.max(90, duration))
    if (timestamp < m.startTime || timestamp > m.endTime + release) continue

    const dir = m.direction === "up" ? 1 : -1
    const strength = Math.max(0, Math.min(100, m.strength)) / 100
    const prof = STYLE_PROFILES[m.style && STYLE_PROFILES[m.style] ? m.style : "natural"]

    const key = `${m.symbol}|${m.startTime}|${m.endTime}|${m.direction}|${m.style || "natural"}|${m.strength}`
    let path = pathCache.get(key)
    if (!path) {
      path = buildManipPath(m.startTime + symSeed, prof, strength)
      if (pathCache.size > 200) pathCache.clear()
      pathCache.set(key, path)
    }

    const p = Math.min(1, (timestamp - m.startTime) / duration)

    // O deslocamento total nasce de uma VELOCIDADE (velas por minuto) multiplicada pela duracao,
    // em vez de um tamanho fixo. E isso que garante que os candles manipulados tenham o mesmo
    // porte dos naturais: uma janela de 1 min anda ~meia vela, uma de 15 min anda ~7 velas.
    const unit = band * NATURAL_CANDLE
    const minutes = duration / 60
    // Teto: nem a tendencia mais forte pode arrastar o preco alem de ~10 velas normais, senao
    // o grafico sai da escala e a manipulacao volta a ficar visivel.
    // Piso de 1,6 vela: numa janela de 1 minuto o deslocamento seria menor que o proprio ruido
    // do minuto e a direcao forcada podia nao se confirmar.
    const total = Math.min(unit * 10, Math.max(unit * 1.6, unit * prof.pace * (0.4 + 1.2 * strength) * minutes))
    const value = shapeAt(path, p)

    // Depois do fim da janela tudo se dissolve junto, na mesma proporcao, para o preco nao dar
    // nenhum salto ao voltar ao normal.
    let fade = 1
    if (timestamp > m.endTime) {
      const f = (timestamp - m.endTime) / release
      fade = 1 - f * f * (3 - 2 * f)
    }

    // Compensacao: cancela o quanto a tendencia natural lenta andou desde o inicio da janela.
    // Sem isso o mercado sintetico podia empurrar o preco para o lado oposto com mais forca do
    // que a manipulacao e a operacao perdia apesar da direcao forcada.
    const counter = (slowNaturalDev(symSeed, timestamp) - slowNaturalDev(symSeed, m.startTime)) * band

    // Ruido rapido sobreposto: pavios e candles de cor contraria dentro de cada perna. Nao muda
    // o destino (media zero), so tira a aparencia de linha desenhada.
    // Perto do fim da janela o ruido e reduzido: assim o fechamento e definido pelo caminho
    // controlado e nao por um pavio aleatorio que poderia inverter o resultado da operacao.
    const easeIn = Math.min(1, (timestamp - m.startTime) / 20) * (1 - 0.75 * Math.max(0, (p - 0.85) / 0.15))
    const wick =
      0.5 * valueNoise(timestamp / 34 + symSeed, symSeed + 21) +
      0.3 * valueNoise(timestamp / 13 + symSeed, symSeed + 41) +
      0.2 * valueNoise(timestamp / 5 + symSeed, symSeed + 61)

    // O ruido tambem e medido em velas normais (antes usava a banda inteira, o que sozinho ja
    // gerava pavios de 2,5 velas). Nao tem direcao: e simetrico e de media zero.
    drift +=
      fade * (dir * total * value - counter + unit * prof.wick * (0.8 + 0.5 * strength) * wick * easeIn)
  }
  return drift
}

export const OTC_ASSETS: OTCAsset[] = [
  { symbol: "EURUSD_OTC", name: "EUR/USD OTC", basePrice: 1.085, pipSize: 0.00001, volatility: 35, icon: "EU", decimals: 5 },
  { symbol: "GBPUSD_OTC", name: "GBP/USD OTC", basePrice: 1.265, pipSize: 0.00001, volatility: 40, icon: "GB", decimals: 5 },
  { symbol: "USDJPY_OTC", name: "USD/JPY OTC", basePrice: 149.5, pipSize: 0.001, volatility: 38, icon: "JP", decimals: 3 },
  { symbol: "AUDUSD_OTC", name: "AUD/USD OTC", basePrice: 0.655, pipSize: 0.00001, volatility: 32, icon: "AU", decimals: 5 },
  { symbol: "BTCUSD_OTC", name: "BTC/USD OTC", basePrice: 43500, pipSize: 0.01, volatility: 150, icon: "BTC", decimals: 2 },
  // Novos ativos
  { symbol: "USDBRL_OTC", name: "USD/BRL OTC", basePrice: 5.42, pipSize: 0.0001, volatility: 34, icon: "BR", decimals: 4 },
  { symbol: "SPACEX_OTC", name: "SpaceXCoin OTC", basePrice: 18.75, pipSize: 0.001, volatility: 130, icon: "SX", decimals: 3 },
  { symbol: "TRUMP_OTC", name: "TRUMP Coin OTC", basePrice: 9.4, pipSize: 0.001, volatility: 120, icon: "TR", decimals: 3 },
  { symbol: "AMZN_OTC", name: "Amazon OTC", basePrice: 178.5, pipSize: 0.01, volatility: 60, icon: "AMZ", decimals: 2 },
  { symbol: "PENUSD_OTC", name: "PEN/USD OTC", basePrice: 0.267, pipSize: 0.00001, volatility: 28, icon: "PE", decimals: 5 },
  // Lote adicional
  { symbol: "ONDO_OTC", name: "Ondo OTC", basePrice: 1.18, pipSize: 0.0001, volatility: 110, icon: "OND", decimals: 4 },
  { symbol: "SHIBUSD_OTC", name: "SHIB/USD OTC", basePrice: 0.0000245, pipSize: 0.0000001, volatility: 140, icon: "SHIB", decimals: 8 },
  { symbol: "TSLA_OTC", name: "Tesla OTC", basePrice: 248.6, pipSize: 0.01, volatility: 70, icon: "TSLA", decimals: 2 },
  { symbol: "PEPE_OTC", name: "Pepe OTC", basePrice: 0.0000118, pipSize: 0.0000001, volatility: 160, icon: "PEPE", decimals: 8 },
  { symbol: "META_OTC", name: "Meta OTC", basePrice: 482.3, pipSize: 0.01, volatility: 65, icon: "META", decimals: 2 },
  { symbol: "DOGE_OTC", name: "DogeCoin OTC", basePrice: 0.162, pipSize: 0.00001, volatility: 135, icon: "DOGE", decimals: 5 },
  // Pares de iene (mercado forex) - preco na casa das centenas com 3 casas decimais
  { symbol: "GBPJPY_OTC", name: "GBP/JPY OTC", basePrice: 189.5, pipSize: 0.001, volatility: 45, icon: "GJ", decimals: 3 },
  { symbol: "EURJPY_OTC", name: "EUR/JPY OTC", basePrice: 162.3, pipSize: 0.001, volatility: 42, icon: "EJ", decimals: 3 },
  { symbol: "AUDJPY_OTC", name: "AUD/JPY OTC", basePrice: 98.05, pipSize: 0.001, volatility: 40, icon: "AJ", decimals: 3 },
  // Mercado aberto (nao-OTC) - precos REAIS via feed; basePrice e so o valor inicial ate o
  // feed carregar, entao mantemos proximo do mercado atual para evitar "salto" na abertura.
  { symbol: "EURUSD", name: "EUR/USD", basePrice: 1.14, pipSize: 0.00001, volatility: 35, icon: "EU", decimals: 5 },
  { symbol: "GBPJPY", name: "GBP/JPY", basePrice: 217, pipSize: 0.001, volatility: 45, icon: "GJ", decimals: 3 },
  { symbol: "EURJPY", name: "EUR/JPY", basePrice: 192, pipSize: 0.001, volatility: 42, icon: "EJ", decimals: 3 },
  { symbol: "AUDUSD", name: "AUD/USD", basePrice: 0.697, pipSize: 0.00001, volatility: 32, icon: "AU", decimals: 5 },
  { symbol: "AUDJPY", name: "AUD/JPY", basePrice: 115, pipSize: 0.001, volatility: 40, icon: "AJ", decimals: 3 },
  { symbol: "BTCUSD", name: "BTC/USD", basePrice: 43500, pipSize: 0.01, volatility: 150, icon: "BTC", decimals: 2 },
  // Majors reais adicionais (mercado aberto) - alimentados pelo feed REAL da Coinbase.
  { symbol: "GBPUSD", name: "GBP/USD", basePrice: 1.343, pipSize: 0.00001, volatility: 40, icon: "GU", decimals: 5 },
  { symbol: "USDJPY", name: "USD/JPY", basePrice: 157.2, pipSize: 0.001, volatility: 38, icon: "UJ", decimals: 3 },
  { symbol: "USDCHF", name: "USD/CHF", basePrice: 0.81, pipSize: 0.00001, volatility: 30, icon: "UC", decimals: 5 },
  { symbol: "USDCAD", name: "USD/CAD", basePrice: 1.4045, pipSize: 0.00001, volatility: 30, icon: "UD", decimals: 5 },
  { symbol: "NZDUSD", name: "NZD/USD", basePrice: 0.5869, pipSize: 0.00001, volatility: 32, icon: "NU", decimals: 5 },
  { symbol: "EURGBP", name: "EUR/GBP", basePrice: 0.8571, pipSize: 0.00001, volatility: 26, icon: "EG", decimals: 5 },
]

// =============================================
// DETERMINISTIC RNG
// =============================================
function srand(seed: number): number {
  const x = Math.sin(seed * 12345.6789 + 0.7) * 43758.5453
  return x - Math.floor(x)
}

// =============================================
// PURE, STATELESS PRICE GENERATION
// =============================================
// IMPORTANT: This must be a pure function of (asset, timestamp). It cannot depend
// on any mutable cache of a "previous tick", because in serverless the process
// memory is cold between requests, which made the previous implementation collapse
// to basePrice on every call (a frozen chart). We build a continuous, smoothly
// moving price by layering value-noise octaves over time — deterministic and O(1).

// Smooth value noise in [-1, 1]: interpolate deterministic randoms at integer steps.
function valueNoise(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const a = srand(i + seed)
  const b = srand(i + 1 + seed)
  const u = f * f * (3 - 2 * f) // smoothstep
  return (a * (1 - u) + b * u) * 2 - 1
}

// Octaves: longer periods set the trend, shorter periods add live wiggle every tick.
// Perfil estilo IQ Option: o preco e fortemente DIRECIONAL — segue uma tendencia por varios
// segundos com poucas reversoes (uma a cada ~10s nos majors), em vez de chacoalhar rapido para
// cima/baixo. As oitavas lentas dominam; as rapidas ficam bem discretas, apenas o suficiente
// para os ativos de preco minusculo (PEPE/SHIB) continuarem ticando sem congelar.
const PRICE_OCTAVES = [
  { period: 3000, amp: 1.15 }, // ~50 min macro trend
  { period: 1200, amp: 0.8 }, // ~20 min swing
  { period: 450, amp: 0.45 }, // ~7 min move
  { period: 150, amp: 0.26 }, // ~2.5 min
  { period: 50, amp: 0.15 }, // ~50 s
  { period: 16, amp: 0.09 }, // ~16 s
  { period: 5, amp: 0.05 }, // ~5 s micro
]
const PRICE_OCTAVE_TOTAL = PRICE_OCTAVES.reduce((s, o) => s + o.amp, 0)

function getLivePrice(asset: OTCAsset, timestamp: number): number {
  const symSeed = asset.basePrice * 13.37

  let dev = 0
  for (let i = 0; i < PRICE_OCTAVES.length; i++) {
    const { period, amp } = PRICE_OCTAVES[i]
    dev += valueNoise(timestamp / period + i * 137.5 + symSeed, symSeed + i) * amp
  }
  // Normalize to roughly [-1, 1]
  dev = dev / PRICE_OCTAVE_TOTAL

  // A largura da banda ESCALA com a volatilidade do ativo (vol ~28..160 -> ~0.5%..2.4%).
  // Antes era fixa em 0.6% para todos, o que deixava o movimento de ativos muito volateis
  // (cripto) pequeno demais para ser visivel tick a tick. Agora cada ativo se move de forma
  // condizente com seu perfil.
  const bandPct = 0.004 + (asset.volatility / 100) * 0.012
  const maxDev = asset.basePrice * bandPct
  let price = asset.basePrice + dev * maxDev

  // Hard cap proporcional a propria banda, para nunca "estourar" a escala do grafico.
  const hardCap = asset.basePrice * bandPct * 1.3
  price = Math.max(asset.basePrice - hardCap, Math.min(asset.basePrice + hardCap, price))

  // Manipulacao do admin: aplicada DEPOIS do clamp, para poder mover o preco alem da banda
  // normal e forcar visivelmente a direcao dos candles (e o resultado das operacoes).
  const drift = manipulationDrift(asset, timestamp)
  if (drift !== 0) {
    price += drift
    if (price < asset.pipSize) price = asset.pipSize // nunca negativo
  }

  const prec = asset.decimals
  return Number(price.toFixed(prec))
}

// =============================================
// PRECO REAL DE MERCADO (mercado aberto)
// =============================================
// Os ativos de mercado aberto refletem o mercado de verdade: preco e velas vem do feed real
// (Yahoo Finance, a mesma cotacao que o TradingView exibe) e sao usados exatamente como vem.
//
// Nada e sintetizado aqui: sem micro-movimento, sem pavios inventados e sem a manipulacao do
// admin, que continua valendo apenas nos ativos OTC — sinteticos por natureza. Assim o que
// acontece no mercado aparece igual na plataforma.

/** Preco de um ativo de mercado aberto: o valor real, apenas arredondado para exibicao. */
// =============================================
// MOVIMENTO INTRAMINUTO (ancorado no preco real)
// =============================================
// A fonte publica de precos entrega ~2 atualizacoes por MINUTO, com precisao de 1 pip, e as
// velas de 1m vem sem corpo (high == low em 100% delas). Isso deixava o grafico praticamente
// parado, diferente do TradingView, que recebe streaming tick a tick.
//
// Estas oitavas rapidas geram o movimento DENTRO do periodo, somado ao preco real (a ancora).
// A media da oscilacao e ~zero, entao o preco continua girando em torno do valor real de
// mercado: a direcao e o nivel sao reais, apenas o caminho entre duas leituras e sintetizado.
//
// E uma funcao PURA do tempo (mesmas oitavas deterministicas do resto do motor), o que garante
// duas propriedades essenciais: o historico nao se redesenha a cada recarga da pagina, e o
// servidor pode recalcular exatamente o mesmo valor de um instante passado ao liquidar.
// As oitavas LENTAS (varios minutos) sao as que dao ao grafico a forma de mercado: sao elas que
// produzem a ondulacao de ~15 pips ao longo de 30 min vista no TradingView. A fonte publica nao
// tem essa estrutura (seus fechamentos variam ~1 pip em 30 min, praticamente uma linha reta),
// entao sem elas o grafico ficava achatado. As oitavas rapidas apenas preenchem o interior da
// vela e mantem o preco ticando entre frames.
const MICRO_OCTAVES = [
  // Amplitude proporcional a RAIZ do periodo (escalonamento browniano). E assim que um preco de
  // mercado se comporta, e e o que reproduz a proporcao certa entre a escala do grafico e o
  // tamanho da vela: no TradingView o eixo de 30 min mede ~17 pips enquanto cada vela mede 1 a 3.
  // Tentativas anteriores com poucas ondas erravam essa proporcao por 4x -- ou o eixo ficava
  // achatado, ou cada vela virava um bloco de 5 pips.
  { period: 2400, amp: 1.0 }, // ~40 min: tendencia
  { period: 1200, amp: 0.707 },
  { period: 600, amp: 0.5 },
  { period: 300, amp: 0.354 },
  { period: 150, amp: 0.25 },
  { period: 75, amp: 0.12 }, // ~1 min: define o corpo da vela (reduzido p/ velas menores)
  { period: 37, amp: 0.09 },
  { period: 18, amp: 0.088 },
  { period: 9, amp: 0.0625 }, // pavios
  { period: 4.5, amp: 0.044 },
  { period: 2, amp: 0.03 },
  { period: 1, amp: 0.02 },
  { period: 0.45, amp: 0.014 }, // tick a tick: mantem o preco vivo entre frames
]
const MICRO_OCTAVE_TOTAL = MICRO_OCTAVES.reduce((s, o) => s + o.amp, 0)

/** Desvio intraminuto normalizado em [-1, 1], deterministico no tempo. */
function microDev(asset: OTCAsset, tSec: number): number {
  const symSeed = asset.basePrice * 91.7 + asset.volatility
  let dev = 0
  for (let i = 0; i < MICRO_OCTAVES.length; i++) {
    const { period, amp } = MICRO_OCTAVES[i]
    dev += valueNoise(tSec / period + i * 51.3 + symSeed, symSeed + i * 7) * amp
  }
  return dev / MICRO_OCTAVE_TOTAL
}

/**
 * Amplitude da oscilacao, MEDIDA a partir do proprio dado real: a mediana do movimento de
 * fechamento a fechamento dos ultimos periodos.
 *
 * Antes isto era uma constante multiplicada por `asset.volatility`, e o resultado ficou ~10x
 * maior que o mercado (velas de 29 pips no EUR/USD, contra 1 a 3 pips reais) porque
 * `volatility` esta numa escala de 0 a 160, nao em porcentagem. Derivar do dado real elimina a
 * constante: em mercado calmo as velas ficam pequenas como no TradingView, e em mercado agitado
 * crescem sozinhas, sem calibragem por ativo.
 *
 * Usa mediana, e nao media, para um unico salto de dado nao inflar a escala do grafico inteiro.
 */
function measuredBand(asset: OTCAsset, real: RealCandle[], price: number): number {
  const moves: number[] = []
  for (let i = Math.max(1, real.length - 40); i < real.length; i++) {
    const d = Math.abs(real[i].close - real[i - 1].close)
    if (d > 0) moves.push(d)
  }

  // Piso por ativo: a amplitude intradiaria tipica da classe, escalada pela volatilidade do
  // catalogo (0-160). E o que sustenta a forma do grafico quando a fonte vem quase congelada,
  // como acontece no EUR/USD. Teto: limita o efeito de dados anomalos da fonte.
  const floor = price * (asset.volatility / 100) * 0.0052
  const ceil = price * 0.004

  if (!moves.length) return floor
  moves.sort((a, b) => a - b)
  const median = moves[Math.floor(moves.length / 2)]

  // Se a fonte tiver movimento proprio maior que o piso, ele manda: em mercado agitado as velas
  // crescem sozinhas, sem depender da constante.
  return Math.min(ceil, Math.max(floor, median * 1.5))
}

/** Preco exibido: ancora real + oscilacao intraminuto. */
function realDisplayPrice(asset: OTCAsset, anchor: number, tSec: number, band: number): number {
  const p = anchor + microDev(asset, tSec) * band
  return Number(p.toFixed(asset.decimals))
}

/**
 * Converte uma vela real do feed em vela do motor. A abertura e o fechamento reais sao sempre
 * preservados (sao o dado de mercado); a maxima e a minima recebem o caminho intraminuto quando
 * a fonte nao informa corpo algum. `endSec` limita a amostragem na vela em formacao, para ela
 * crescer com o tempo em vez de ja nascer com o corpo inteiro.
 */
function toEngineCandle(
  asset: OTCAsset,
  rc: RealCandle,
  tf?: number,
  endSec?: number,
  band?: number,
  prevClose?: number,
): OTCCandle {
  const prec = asset.decimals

  if (!tf || !band) {
    return {
      time: rc.time,
      open: Number(rc.open.toFixed(prec)),
      high: Number(rc.high.toFixed(prec)),
      low: Number(rc.low.toFixed(prec)),
      close: Number(rc.close.toFixed(prec)),
    }
  }

  const end = Math.min(endSec ?? rc.time + tf, rc.time + tf)
  const span = Math.max(1, end - rc.time)
  const samples = 12

  // O nivel real do periodo e a ancora; a oscilacao move o preco em volta dela. A oscilacao
  // entra no CORPO (abertura/fechamento), e nao so nos pavios: aplicada apenas as extremidades,
  // o corpo ficava colado no nivel achatado da fonte e os pavios flutuavam soltos.
  const closePrice = rc.close + microDev(asset, end) * band
  // Abertura = fechamento da vela anterior, para a serie nao abrir vaos entre velas.
  const openPrice = prevClose ?? rc.open + microDev(asset, rc.time) * band

  let high = Math.max(openPrice, closePrice)
  let low = Math.min(openPrice, closePrice)
  for (let i = 0; i <= samples; i++) {
    const t = rc.time + (i * span) / samples
    // Base: a reta ancora_abertura -> ancora_fechamento (o movimento real do periodo).
    const base = rc.open + (rc.close - rc.open) * (i / samples)
    const p = base + microDev(asset, t) * band
    if (p > high) high = p
    if (p < low) low = p
  }

  return {
    time: rc.time,
    // A maxima/minima reais nunca sao reduzidas: quando a fonte informa corpo, ele e respeitado.
    high: Number(Math.max(high, rc.high).toFixed(prec)),
    low: Number(Math.min(low, rc.low).toFixed(prec)),
    open: Number(openPrice.toFixed(prec)),
    close: Number(closePrice.toFixed(prec)),
  }
}

// =============================================
// HISTORICAL CANDLE BUILDER
// =============================================
function buildCandle(asset: OTCAsset, startTime: number, timeframe: number): OTCCandle {
  const prec = asset.decimals
  // Only 10 samples per candle (was 60) - 6x faster, still realistic OHLC
  const samples = 10
  const prices: number[] = []

  for (let i = 0; i <= samples; i++) {
    const t = startTime + (i * timeframe) / samples
    prices.push(getLivePrice(asset, t))
  }

  const open = prices[0]
  const close = prices[prices.length - 1]
  let high = Math.max(...prices)
  let low = Math.min(...prices)

  // Realistic wicks
  const sd = startTime * 7777
  const body = Math.abs(close - open) || asset.pipSize * 5
  if (srand(sd * 3) > 0.35) high = Math.max(high, Math.max(open, close) + body * (0.2 + srand(sd * 5) * 1.0))
  if (srand(sd * 7) > 0.35) low = Math.min(low, Math.min(open, close) - body * (0.2 + srand(sd * 9) * 1.0))

  return {
    time: startTime,
    open: Number(open.toFixed(prec)),
    high: Number(high.toFixed(prec)),
    low: Number(low.toFixed(prec)),
    close: Number(close.toFixed(prec)),
  }
}

// =============================================
// SINGLETON ENGINE
// =============================================
class MultiAssetEngine {
  private static instance: MultiAssetEngine | null = null
  private maxCandles = 30
  private cache = new Map<string, { ts: number; data: any }>()

  private constructor() {}
  static getInstance(): MultiAssetEngine {
    if (!MultiAssetEngine.instance) MultiAssetEngine.instance = new MultiAssetEngine()
    return MultiAssetEngine.instance
  }

  getCurrentPrice(symbol: string): number {
    const asset = OTC_ASSETS.find(a => a.symbol === symbol)
    if (!asset) return 0
    // Mercado aberto: nivel e direcao vem do mercado real; a oscilacao entre duas leituras da
    // fonte (que chegam ~2x por minuto) e sintetizada para o preco nao ficar parado.
    if (hasRealPrice(symbol)) {
      const anchor = getRealPrice(symbol)
      const band = measuredBand(asset, getRealCandles(symbol, 60) ?? [], anchor)
      return realDisplayPrice(asset, anchor, Date.now() / 1000, band)
    }
    return getLivePrice(asset, Date.now() / 1000)
  }

  /** Repassa as velas reais preservando abertura e fechamento de mercado. */
  private anchoredCandles(asset: OTCAsset, real: RealCandle[], tf: number): OTCCandle[] {
    const nowSec = Date.now() / 1000
    const band = measuredBand(asset, real, real[real.length - 1]?.close ?? asset.basePrice)
    const out: OTCCandle[] = []
    let prevClose: number | undefined
    for (const rc of real) {
      const c = toEngineCandle(asset, rc, tf, nowSec, band, prevClose)
      out.push(c)
      prevClose = c.close
    }
    return out
  }

  getCandles(symbol: string, timeframe: 60 | 300 | 600): OTCCandle[] {
    const asset = OTC_ASSETS.find(a => a.symbol === symbol)
    if (!asset) return []
    const real = getRealCandles(symbol, timeframe)
    if (real && real.length) {
      return this.anchoredCandles(asset, real.slice(-this.maxCandles), timeframe)
    }
    const now = Math.floor(Date.now() / 1000)
    const candleStart = Math.floor(now / timeframe) * timeframe
    const candles: OTCCandle[] = []
    for (let i = this.maxCandles; i > 0; i--) {
      candles.push(buildCandle(asset, candleStart - i * timeframe, timeframe))
    }
    return candles
  }

  // Returns ~24h of candles for the given timeframe, built oldest-first.
  getHistory(symbol: string, timeframe: 60 | 300 | 600): OTCCandle[] {
    const asset = OTC_ASSETS.find(a => a.symbol === symbol)
    if (!asset) return []
    const real = getRealCandles(symbol, timeframe)
    if (real && real.length) return this.anchoredCandles(asset, real, timeframe)
    const now = Math.floor(Date.now() / 1000)
    const candleStart = Math.floor(now / timeframe) * timeframe
    const count = Math.min(1440, Math.ceil((24 * 60 * 60) / timeframe))
    const candles: OTCCandle[] = []
    for (let i = count; i > 0; i--) {
      candles.push(buildCandle(asset, candleStart - i * timeframe, timeframe))
    }
    return candles
  }

  getCurrentCandle(symbol: string, timeframe: 60 | 300 | 600): OTCCandle | null {
    const asset = OTC_ASSETS.find(a => a.symbol === symbol)
    if (!asset) return null
    const prec = asset.decimals

    // Vela viva do mercado aberto: abre no valor real do periodo e fecha no preco exibido
    // agora, que oscila a cada frame em torno da ancora real. Sem isso a vela ficava parada
    // por ~30 s, ate a fonte publica enviar a proxima leitura.
    if (hasRealPrice(symbol)) {
      const nowSec = Date.now() / 1000
      const cs = Math.floor(nowSec / timeframe) * timeframe
      const real = getRealCandles(symbol, timeframe)
      const current = real?.find(c => c.time === cs)
      const anchor = getRealPrice(symbol)
      const band = measuredBand(asset, real ?? [], anchor)
      const close = realDisplayPrice(asset, anchor, nowSec, band)

      const open = current
        ? Number(current.open.toFixed(prec))
        : real?.length
          ? Number(real[real.length - 1].close.toFixed(prec))
          : close

      // Percorre o trecho ja transcorrido para a maxima/minima crescerem junto com a vela.
      let high = Math.max(open, close)
      let low = Math.min(open, close)
      const elapsed = Math.max(1, nowSec - cs)
      for (let i = 1; i <= 10; i++) {
        const p = anchor + microDev(asset, cs + (elapsed * i) / 10) * band
        if (p > high) high = p
        if (p < low) low = p
      }
      if (current) {
        // A maxima/minima reais informadas pela fonte nunca sao reduzidas.
        high = Math.max(high, current.high)
        low = Math.min(low, current.low)
      }

      return {
        time: cs,
        open,
        high: Number(high.toFixed(prec)),
        low: Number(low.toFixed(prec)),
        close,
      }
    }

    const now = Date.now() / 1000
    const candleStart = Math.floor(now / timeframe) * timeframe

    const openPrice = getLivePrice(asset, candleStart)
    const closePrice = getLivePrice(asset, now)
    // Only 5 samples instead of per-second loop (was O(elapsed), now O(1))
    let high = Math.max(openPrice, closePrice)
    let low = Math.min(openPrice, closePrice)
    const elapsed = now - candleStart
    for (let i = 1; i <= 4; i++) {
      const t = candleStart + (elapsed * i) / 5
      const p = getLivePrice(asset, t)
      if (p > high) high = p
      if (p < low) low = p
    }

    return {
      time: candleStart,
      open: Number(openPrice.toFixed(prec)),
      high: Number(high.toFixed(prec)),
      low: Number(low.toFixed(prec)),
      close: Number(closePrice.toFixed(prec)),
    }
  }

  getAssetState(symbol: string, timeframe: 60 | 300 | 600) {
    const asset = OTC_ASSETS.find(a => a.symbol === symbol)
    const now = Math.floor(Date.now() / 1000)
    const cacheKey = `${symbol}_${timeframe}`
    const cached = this.cache.get(cacheKey)

    // Cache candles for 5 seconds (deterministic, only change at candle boundary)
    let candles
    if (cached && now - cached.ts < 5) {
      candles = cached.data
    } else {
      candles = this.getCandles(symbol, timeframe)
      this.cache.set(cacheKey, { ts: now, data: candles })
    }

    return {
      symbol,
      name: asset?.name || symbol,
      price: this.getCurrentPrice(symbol),
      timestamp: now,
      candles,
      currentCandle: this.getCurrentCandle(symbol, timeframe),
      timeframe,
    }
  }

  isEngineRunning() { return true }
  getLastTickTime() { return Math.floor(Date.now() / 1000) }
  start() {}
  stop() {}
}

export const multiAssetEngine = MultiAssetEngine.getInstance()
export const getMultiAssetEngine = () => MultiAssetEngine.getInstance()
