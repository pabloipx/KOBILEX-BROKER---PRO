import { NextResponse } from "next/server"

// Proxy para dados REAIS de cripto (Coinbase). Roda no servidor para evitar CORS e o
// bloqueio geografico que afeta outras exchanges (ex.: Binance) a partir da Vercel.
export const dynamic = "force-dynamic"

// Mapeia o simbolo interno do motor -> produto da Coinbase
const PRODUCTS: Record<string, string> = {
  BTCUSD: "BTC-USD",
}

// Granularidades suportadas pela Coinbase: 60, 300, 900, 3600, 21600, 86400.
// Para 600s (10m) buscamos 300s (5m) e agregamos pares.
function granularityFor(tf: number): number {
  if (tf === 60) return 60
  if (tf === 300) return 300
  if (tf === 600) return 300
  return 60
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol") || "BTCUSD"
  const product = PRODUCTS[symbol] || "BTC-USD"
  const type = searchParams.get("type") || "price"

  try {
    if (type === "price") {
      const r = await fetch(`https://api.coinbase.com/v2/prices/${product}/spot`, { cache: "no-store" })
      if (!r.ok) throw new Error(`spot ${r.status}`)
      const j = await r.json()
      const price = Number(j?.data?.amount)
      if (!Number.isFinite(price)) throw new Error("preco invalido")
      return NextResponse.json({ price })
    }

    // type === "candles"
    const tf = Number(searchParams.get("tf") || 60)
    const gran = granularityFor(tf)
    const r = await fetch(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=${gran}`, {
      cache: "no-store",
    })
    if (!r.ok) throw new Error(`candles ${r.status}`)
    const raw = (await r.json()) as number[][]
    // Formato da Coinbase: [time, low, high, open, close, volume] (mais recente primeiro)
    let candles = raw
      .filter((c) => Array.isArray(c) && c.length >= 5)
      .map((c) => ({ time: c[0], low: c[1], high: c[2], open: c[3], close: c[4] }))
      .sort((a, b) => a.time - b.time)

    // Agrega 5m -> 10m alinhado a limites de 600s
    if (tf === 600) {
      const byBucket = new Map<number, { time: number; open: number; high: number; low: number; close: number }>()
      for (const c of candles) {
        const bucket = Math.floor(c.time / 600) * 600
        const ex = byBucket.get(bucket)
        if (!ex) {
          byBucket.set(bucket, { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close })
        } else {
          ex.high = Math.max(ex.high, c.high)
          ex.low = Math.min(ex.low, c.low)
          ex.close = c.close // c e posterior (ordenado asc)
        }
      }
      candles = Array.from(byBucket.values()).sort((a, b) => a.time - b.time)
    }

    return NextResponse.json({ candles })
  } catch (e) {
    console.log("[v0] crypto feed erro:", (e as Error).message)
    return NextResponse.json({ error: "feed_unavailable" }, { status: 502 })
  }
}
