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

import { hasRealPrice, getRealPrice, getRealCandles } from "./real-price-store"

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
  suave: { slope: 0.09, retrace: 0.08, period: 90 }, // sobe/desce bem devagar e liso
  natural: { slope: 0.12, retrace: 0.16, period: 50 }, // tendencia com pullbacks (padrao)
  forte: { slope: 0.2, retrace: 0.12, period: 30 }, // direcional firme, ainda realista
  volatil: { slope: 0.13, retrace: 0.3, period: 22 }, // mais oscilacao, candles mistos
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
    if (timestamp < m.startTime || timestamp > m.endTime) continue

    const dir = m.direction === "up" ? 1 : -1
    const strength = Math.max(0, Math.min(100, m.strength)) / 100
    const prof = STYLE_PROFILES[m.style && STYLE_PROFILES[m.style] ? m.style : "natural"]
    const elapsedMin = (timestamp - m.startTime) / 60

    // Tendencia: viés direcional SUAVE. Escala com forca, mas cresce de forma amortecida
    // (assintotica) para nao "disparar" em janelas longas — o preco vai indo na direcao
    // sem virar uma rampa reta. maxDrift limita o quanto o drift pode acumular no total.
    const effSlope = prof.slope * (0.5 + 0.7 * strength)
    // Teto de acumulo proporcional ao estilo/forca (em bandas). Chega perto dele suavemente.
    const maxDriftBands = effSlope * 6 // ~6 min para se aproximar do teto
    const linear = effSlope * elapsedMin
    const damped = maxDriftBands * (1 - Math.exp(-linear / Math.max(0.0001, maxDriftBands)))
    const trend = dir * band * damped

    // Retracoes/ruido: ondas simetricas (sobem E descem) sobre a tendencia -> candles mistos,
    // pullbacks e pavios, como um mercado de verdade. Suavizadas na entrada para nao "saltar".
    const easeIn = Math.min(1, elapsedMin / 0.5)
    const wave =
      0.68 * valueNoise(timestamp / prof.period + symSeed, symSeed + 21) +
      0.32 * valueNoise(timestamp / (prof.period * 0.4) + symSeed, symSeed + 41)
    const retrace = band * prof.retrace * (0.6 + 0.5 * strength) * wave * easeIn

    drift += trend + retrace
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
    // Preco REAL (ex.: BTC/USD de mercado aberto) quando o feed esta ativo; senao, sintetico.
    if (hasRealPrice(symbol)) return Number(getRealPrice(symbol).toFixed(asset.decimals))
    return getLivePrice(asset, Date.now() / 1000)
  }

  getCandles(symbol: string, timeframe: 60 | 300 | 600): OTCCandle[] {
    const asset = OTC_ASSETS.find(a => a.symbol === symbol)
    if (!asset) return []
    const real = getRealCandles(symbol, timeframe)
    if (real && real.length) return real.slice(-this.maxCandles)
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
    if (real && real.length) return real
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

    // Vela viva a partir do preco REAL: usa a vela real correspondente (se houver) como base
    // e atualiza o fechamento/maxima/minima com o ultimo preco recebido.
    if (hasRealPrice(symbol)) {
      const price = Number(getRealPrice(symbol).toFixed(prec))
      const cs = Math.floor(Date.now() / 1000 / timeframe) * timeframe
      const real = getRealCandles(symbol, timeframe)
      const match = real?.find(c => c.time === cs)
      const open = match ? match.open : price
      const high = Math.max(match ? match.high : price, price)
      const low = Math.min(match ? match.low : price, price)
      return {
        time: cs,
        open: Number(open.toFixed(prec)),
        high: Number(high.toFixed(prec)),
        low: Number(low.toFixed(prec)),
        close: price,
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
