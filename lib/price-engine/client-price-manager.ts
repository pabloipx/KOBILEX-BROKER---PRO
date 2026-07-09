"use client"

import type { Candle, OTCAsset, PriceUpdate } from "./types"
import { OTC_ASSETS } from "../otc-assets"

type PriceCallback = (update: PriceUpdate) => void
type CandleCallback = (symbol: string, timeframe: number, candle: Candle) => void

interface AssetState {
  price: number
  previousPrice: number
  trend: number
  trendDuration: number
  trendCounter: number
  momentum: number // Adicionado momentum para suavizar
}

class ClientPriceManager {
  private assets: Map<string, AssetState> = new Map()
  private candles: Map<string, Map<number, Candle[]>> = new Map()
  private currentCandles: Map<string, Map<number, Candle>> = new Map()
  private priceListeners: Set<PriceCallback> = new Set()
  private candleListeners: Set<CandleCallback> = new Set()
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  constructor() {
    this.initializeAssets()
  }

  private initializeAssets() {
    for (const asset of OTC_ASSETS) {
      if (!asset.isActive) continue

      this.assets.set(asset.symbol, {
        price: asset.basePrice,
        previousPrice: asset.basePrice,
        trend: 0,
        trendDuration: this.getRandomTrendDuration(),
        trendCounter: 0,
        momentum: 0, // Inicializa momentum
      })

      const candleMap = new Map<number, Candle[]>()
      const currentCandleMap = new Map<number, Candle>()

      for (const tf of [5, 15, 30, 60, 300]) {
        candleMap.set(tf, this.generateHistoricalCandles(asset, tf, 100))
        currentCandleMap.set(tf, this.createNewCandle(asset.basePrice))
      }

      this.candles.set(asset.symbol, candleMap)
      this.currentCandles.set(asset.symbol, currentCandleMap)
    }
  }

  private generateHistoricalCandles(asset: OTCAsset, timeframe: number, count: number): Candle[] {
    const candles: Candle[] = []
    const now = Math.floor(Date.now() / 1000)
    let price = asset.basePrice

    // Volatilidade reduzida para histórico
    const reducedVolatility = asset.volatility * 0.5

    for (let i = count; i > 0; i--) {
      const time = now - i * timeframe
      const volatility = reducedVolatility * Math.sqrt(timeframe / 60)

      const open = price
      const change = (Math.random() - 0.5) * volatility * price
      const close = open + change

      // High e Low proporcionais ao corpo do candle
      const bodySize = Math.abs(close - open)
      const wickSize = bodySize * 0.3 + volatility * price * 0.2
      const high = Math.max(open, close) + Math.random() * wickSize
      const low = Math.min(open, close) - Math.random() * wickSize

      candles.push({
        time,
        open: Number(open.toFixed(5)),
        high: Number(high.toFixed(5)),
        low: Number(low.toFixed(5)),
        close: Number(close.toFixed(5)),
        volume: Math.floor(Math.random() * 1000) + 100,
      })

      const maxDev = asset.basePrice * 0.01
      if (Math.abs(close - asset.basePrice) > maxDev) {
        price = close + (asset.basePrice - close) * 0.1
      } else {
        price = close
      }
    }

    return candles
  }

  private createNewCandle(price: number): Candle {
    return {
      time: Math.floor(Date.now() / 1000),
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
    }
  }

  private getRandomTrendDuration(): number {
    return Math.floor(Math.random() * 90) + 40
  }

  private getRandomTrend(): number {
    const rand = Math.random()
    if (rand < 0.3) return -0.35
    if (rand < 0.7) return 0
    return 0.35
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true

    this.intervalId = setInterval(() => {
      this.tick()
    }, 1000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
  }

  private tick() {
    const now = Math.floor(Date.now() / 1000)

    for (const asset of OTC_ASSETS) {
      if (!asset.isActive) continue

      const state = this.assets.get(asset.symbol)
      if (!state) continue

      // Atualiza tendência com transição suave
      if (state.trendCounter >= state.trendDuration) {
        const newTrend = this.getRandomTrend()
        state.trend = state.trend * 0.6 + newTrend * 0.4
        state.trendDuration = this.getRandomTrendDuration()
        state.trendCounter = 0
      }

      const reducedVolatility = asset.volatility * 0.4

      // Calcula variação com momentum
      const trendImpact = state.trend * reducedVolatility * 0.5
      const noise = (Math.random() - 0.5) * reducedVolatility * 0.3

      // Momentum suaviza transições
      state.momentum = state.momentum * 0.8 + (trendImpact + noise) * 0.2
      const change = state.price * state.momentum

      state.previousPrice = state.price
      state.price += change

      const maxDev = asset.basePrice * 0.012 // 1.2% máximo
      const deviation = state.price - asset.basePrice

      if (Math.abs(deviation) > maxDev) {
        state.price -= deviation * 0.15
      } else if (Math.abs(deviation) > maxDev * 0.5) {
        state.price -= deviation * 0.04
      }

      state.price = Number(state.price.toFixed(5))
      state.trendCounter++

      // Notify price listeners
      const update: PriceUpdate = {
        symbol: asset.symbol,
        price: state.price,
        time: now,
        change: state.price - state.previousPrice,
        changePercent: ((state.price - state.previousPrice) / state.previousPrice) * 100,
      }

      this.priceListeners.forEach((cb) => cb(update))

      // Update candles for each timeframe
      const assetCandles = this.candles.get(asset.symbol)
      const assetCurrentCandles = this.currentCandles.get(asset.symbol)

      if (assetCandles && assetCurrentCandles) {
        for (const tf of [5, 15, 30, 60, 300]) {
          const currentCandle = assetCurrentCandles.get(tf)
          if (!currentCandle) continue

          const candleStartTime = Math.floor(now / tf) * tf

          if (currentCandle.time !== candleStartTime) {
            const completedCandle = { ...currentCandle }
            const history = assetCandles.get(tf) || []
            history.push(completedCandle)

            if (history.length > 200) {
              history.shift()
            }

            assetCandles.set(tf, history)

            assetCurrentCandles.set(tf, {
              time: candleStartTime,
              open: state.price,
              high: state.price,
              low: state.price,
              close: state.price,
              volume: 1,
            })
          } else {
            currentCandle.high = Math.max(currentCandle.high, state.price)
            currentCandle.low = Math.min(currentCandle.low, state.price)
            currentCandle.close = state.price
            currentCandle.volume++
          }

          const updatedCandle = assetCurrentCandles.get(tf)
          if (updatedCandle) {
            this.candleListeners.forEach((cb) => cb(asset.symbol, tf, updatedCandle))
          }
        }
      }
    }
  }

  getPrice(symbol: string): number {
    return this.assets.get(symbol)?.price || 0
  }

  getCandles(symbol: string, timeframe: number): Candle[] {
    const assetCandles = this.candles.get(symbol)
    const assetCurrentCandles = this.currentCandles.get(symbol)

    if (!assetCandles) return []

    const history = assetCandles.get(timeframe) || []
    const current = assetCurrentCandles?.get(timeframe)

    return current ? [...history, current] : history
  }

  onPriceUpdate(callback: PriceCallback): () => void {
    this.priceListeners.add(callback)
    return () => this.priceListeners.delete(callback)
  }

  onCandleUpdate(callback: CandleCallback): () => void {
    this.candleListeners.add(callback)
    return () => this.candleListeners.delete(callback)
  }
}

// Singleton
let instance: ClientPriceManager | null = null

export function getClientPriceManager(): ClientPriceManager {
  if (!instance) {
    instance = new ClientPriceManager()
  }
  return instance
}
