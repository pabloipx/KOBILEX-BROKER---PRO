import { NextResponse } from "next/server"
import { setRealCandles, setRealPrice } from "@/lib/price-engine/real-price-store"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"

// Rota TEMPORARIA de verificacao: confere se as velas reais chegam ao grafico sem alteracao.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const base = new URL(req.url).origin
  const out: any[] = []

  for (const symbol of ["EURUSD", "GBPJPY", "BTCUSD"]) {
    const cr = await fetch(`${base}/api/market/crypto?type=candles&symbol=${symbol}&tf=60`, { cache: "no-store" })
    const { candles } = await cr.json()
    const pr = await fetch(`${base}/api/market/crypto?type=price&symbol=${symbol}`, { cache: "no-store" })
    const { price } = await pr.json()

    setRealCandles(symbol, 60, candles)
    setRealPrice(symbol, price)

    const engine = multiAssetEngine.getCandles(symbol, 60)
    const real = candles.slice(-engine.length)

    let maxDiffPct = 0
    let timeMismatches = 0
    for (let i = 0; i < engine.length; i++) {
      const e = engine[i]
      const r = real[i]
      if (e.time !== r.time) timeMismatches++
      for (const k of ["open", "high", "low", "close"] as const) {
        maxDiffPct = Math.max(maxDiffPct, (Math.abs(e[k] - r[k]) / r[k]) * 100)
      }
    }

    const livePrice = multiAssetEngine.getCurrentPrice(symbol)

    out.push({
      symbol,
      candlesCompared: engine.length,
      timeMismatches,
      maxOhlcDiffPct: Number(maxDiffPct.toFixed(8)),
      realPrice: price,
      enginePrice: livePrice,
      priceDiffPct: Number((((livePrice - price) / price) * 100).toFixed(8)),
      lastRealCandle: real[real.length - 1],
      lastEngineCandle: engine[engine.length - 1],
    })
  }

  return NextResponse.json(out)
}
