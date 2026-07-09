import { NextResponse } from "next/server"
import { getPriceManager } from "@/lib/price-engine/price-manager"

/**
 * Get current price for a symbol
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol")

    if (!symbol) {
      return NextResponse.json({ error: "Symbol parameter required" }, { status: 400 })
    }

    const priceManager = getPriceManager()
    const currentPrice = priceManager.getCurrentPrice(symbol)

    if (currentPrice === null) {
      return NextResponse.json({ error: "Symbol not found" }, { status: 404 })
    }

    return NextResponse.json({
      symbol,
      price: currentPrice,
      timestamp: Math.floor(Date.now() / 1000),
    })
  } catch (error) {
    console.error("[v0] Error fetching current price:", error)
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 })
  }
}
