/**
 * OTC Price Generator
 * Generates realistic price movements with controlled volatility
 * This is the ONLY source of truth for prices
 */

interface PriceState {
  currentPrice: number
  trend: number // -1 to 1, direction of price movement
  trendDuration: number // how many ticks this trend lasts
  trendCounter: number // current tick count in this trend
}

export class OTCPriceGenerator {
  private symbol: string
  private basePrice: number
  private volatility: number
  private priceState: PriceState

  constructor(symbol: string, basePrice: number, volatility = 0.0015) {
    this.symbol = symbol
    this.basePrice = basePrice
    this.volatility = volatility
    this.priceState = {
      currentPrice: basePrice,
      trend: 0,
      trendDuration: this.getRandomTrendDuration(),
      trendCounter: 0,
    }
  }

  /**
   * Generate next price tick
   * Called every second to create realistic price movement
   */
  getNextPrice(): number {
    // Update trend if duration expired
    if (this.priceState.trendCounter >= this.priceState.trendDuration) {
      this.priceState.trend = this.getRandomTrend()
      this.priceState.trendDuration = this.getRandomTrendDuration()
      this.priceState.trendCounter = 0
    }

    // Calculate price change with trend and random noise
    const trendImpact = this.priceState.trend * this.volatility * 0.7
    const randomNoise = (Math.random() - 0.5) * this.volatility * 0.6
    const priceChange = this.priceState.currentPrice * (trendImpact + randomNoise)

    // Update current price
    this.priceState.currentPrice += priceChange

    // Prevent price from going too far from base
    const maxDeviation = this.basePrice * 0.05 // 5% max deviation
    if (Math.abs(this.priceState.currentPrice - this.basePrice) > maxDeviation) {
      // Pull back towards base price
      const pullback = (this.basePrice - this.priceState.currentPrice) * 0.1
      this.priceState.currentPrice += pullback
    }

    this.priceState.trendCounter++

    return Number(this.priceState.currentPrice.toFixed(5))
  }

  private getRandomTrend(): number {
    // -1 (bearish), 0 (sideways), 1 (bullish)
    const rand = Math.random()
    if (rand < 0.35) return -0.8 // bearish
    if (rand < 0.65) return 0 // sideways
    return 0.8 // bullish
  }

  private getRandomTrendDuration(): number {
    // Trend lasts 30-120 seconds
    return Math.floor(Math.random() * 90) + 30
  }

  getCurrentPrice(): number {
    return this.priceState.currentPrice
  }

  getSymbol(): string {
    return this.symbol
  }
}
