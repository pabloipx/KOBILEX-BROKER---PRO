import { NextResponse } from "next/server"
import { getPriceManager } from "@/lib/price-engine/price-manager"

/**
 * Get historical candles for a symbol and timeframe
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol")
    const timeframeParam = searchParams.get("timeframe")

    if (!symbol || !timeframeParam) {
      return NextResponse.json({ error: "Symbol and timeframe parameters required" }, { status: 400 })
    }

    const timeframe = Number(timeframeParam) as 60 | 300 | 600

    if (![60, 300, 600].includes(timeframe)) {
      return NextResponse.json({ error: "Invalid timeframe. Must be 60, 300, or 600" }, { status: 400 })
    }

    const priceManager = getPriceManager()
    const candles = priceManager.getHistoricalCandles(symbol, timeframe)
    const currentCandle = priceManager.getCurrentCandle(symbol, timeframe)

    return NextResponse.json({
      symbol,
      timeframe,
      candles,
      currentCandle,
    })
  } catch (error) {
    console.error("[v0] Error fetching candles:", error)
    return NextResponse.json({ error: "Failed to fetch candles" }, { status: 500 })
  }
}
