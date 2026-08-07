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

// Perfis de comportamento (CALIBRADOS para ficar realista, do tamanho de um candle normal):
// - slope:   viés direcional em fracao da banda natural por MINUTO. Valores baixos porque
//            um candle OTC normal anda so uma pequena fracao da banda; a manipulacao apenas
//            inclina levemente essa caminhada na direcao desejada, sem "rampas" gigantes.
// - retrace: amplitude das retracoes/ruido (fracao da banda) -> candles mistos e pullbacks.
// - period:  periodo (s) das ondas de retracao -> frequencia dos pullbacks.
const STYLE_PROFILES: Record<ManipulationStyle, { slope: number; retrace: number; period: number }> = {
  suave: { slope: 0.16, retrace: 0.1, period: 90 }, // sobe/desce devagar e liso, direcional
  natural: { slope: 0.2, retrace: 0.18, period: 50 }, // tendencia com pullbacks (padrao)
  forte: { slope: 0.34, retrace: 0.12, period: 30 }, // direcional firme e confiavel
  volatil: { slope: 0.2, retrace: 0.34, period: 22 }, // muita oscilacao, mais realista/arriscado
}

let activeManipulations: Manipulation[] = []

export function setManipulations(list: Manipulation[]) {
  activeManipulations = Array.isArray(list) ? list : []
}

export function getManipulations(): Manipulation[] {
  return activeManipulations
}

// Retorna o deslocamento de preco a aplicar para um ativo em um dado timestamp.
// = tendencia forcada (leva o preco na direcao) + retracoes/ruido (dao aparencia real).
function manipulationDrift(asset: OTCAsset, timestamp: number, bandOverride?: number): number {
  if (!activeManipulations.length) return 0

  // Mesma "banda" natural usada em getLivePrice, para o movimento ficar na escala do ativo.
  // Nos ativos de mercado aberto a banda natural e muito menor (o preco vem do mercado real),
  // por isso quem chama passa um bandOverride — senao a manipulacao viraria um candle vertical.
  const bandPct = 0.004 + (asset.volatility / 100) * 0.012
  const band = bandOverride ?? asset.basePrice * bandPct
  const symSeed = asset.basePrice * 13.37

  let drift = 0
  for (let i = 0; i < activeManipulations.length; i++) {
    const m = activeManipulations[i]
    if (m.symbol !== asset.symbol) continue
    if (timestamp < m.startTime || timestamp > m.endTime) continue

    const dir = m.direction === "up" ? 1 : -1
    const strength = Math.max(0, Math.min(100, m.strength)) / 100
    const prof = STYLE_PROFILES[m.style && STYLE_PROFILES[m.style] ? m.style : "natural"]
    const elapsedMin = (timestamp - m.startTime) / 60

    // Tendencia: viés direcional SUAVE. Escala com forca, mas cresce de forma amortecida
    // (assintotica) para nao "disparar" em janelas longas — o preco vai indo na direcao
    // sem virar uma rampa reta. Garante que o RESULTADO final feche na direcao forcada.
    const effSlope = prof.slope * (0.5 + 0.7 * strength)
    const maxDriftBands = effSlope * 6 // ~6 min para se aproximar do teto
    const linear = effSlope * elapsedMin
    const damped = maxDriftBands * (1 - Math.exp(-linear / Math.max(0.0001, maxDriftBands)))
    const trend = dir * band * damped

    // Oscilacao SIMETRICA multi-oitava: move o preco para CIMA e para BAIXO o tempo todo,
    // em varias escalas de tempo. E o que faz o candle ter PAVIOS (topo/fundo dentro do
    // minuto) e faz surgirem candles de cor CONTRARIA (pullbacks) durante a tendencia —
    // como um grafico real. A tendencia acima e mais lenta, entao o RESULTADO ainda fecha
    // na direcao manipulada, mas o caminho ate la parece 100% natural.
    const easeIn = Math.min(1, elapsedMin / 0.4)
    const p = prof.period
    const osc =
      0.46 * valueNoise(timestamp / (p * 1.8) + symSeed, symSeed + 21) + // swing candle-a-candle (cor)
      0.32 * valueNoise(timestamp / (p * 0.75) + symSeed, symSeed + 41) + // movimento dentro do candle
      0.22 * valueNoise(timestamp / (p * 0.28) + symSeed, symSeed + 61) // pavios (rapido)
    const oscillation = band * prof.retrace * (0.9 + 0.6 * strength) * osc * easeIn

    drift += trend + oscillation
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

  /**
   * Preco em um instante ESPECIFICO (segundos), e nao "agora".
   *
   * Usado para liquidar operacoes exatamente no vencimento. Antes a liquidacao lia o preco do
   * momento em que a verificacao rodava -- ate 500 ms depois do vencimento -- e como o preco
   * agora oscila varias vezes por segundo, ele podia ter cruzado a linha de entrada nesse
   * intervalo: o grafico mostrava WIN e o resultado gravado saia LOSS.
   *
   * E deterministico: o mesmo instante sempre devolve o mesmo preco, no cliente ou no servidor.
   */
  getPriceAtTime(symbol: string, tSec: number): number {
    const asset = OTC_ASSETS.find(a => a.symbol === symbol)
    if (!asset) return 0

    if (hasRealPrice(symbol)) {
      const real = getRealCandles(symbol, 60) ?? []
      // Ancora: o fechamento real do minuto que contem o instante pedido. Para o minuto em
      // formacao, o ultimo preco real conhecido -- a mesma ancora que o grafico esta usando.
      const cs = Math.floor(tSec / 60) * 60
      const candle = real.find(c => c.time === cs)
      const anchor = candle ? candle.close : getRealPrice(symbol)
      const band = measuredBand(asset, real, anchor)
      return realDisplayPrice(asset, anchor, tSec, band)
    }
    return getLivePrice(asset, tSec)
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
