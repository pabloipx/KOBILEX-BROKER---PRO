import { NextResponse } from "next/server"

// Proxy para dados REAIS de mercado. Roda no servidor para evitar CORS e o bloqueio
// geografico que afeta algumas exchanges (ex.: Binance) a partir da Vercel.
//
// Fonte: Yahoo Finance. Escolhida porque devolve o OHLC real de mercado (o mesmo que
// o TradingView exibe) para forex e cripto. A Coinbase era usada antes, mas nos pares
// de forex ela retorna a taxa de conversao dela e nao a cotacao de mercado, alem de
// nao ter historico de velas de forex.
export const dynamic = "force-dynamic"

// Mapeia o simbolo interno do motor -> simbolo do Yahoo Finance
const YAHOO_SYMBOLS: Record<string, string> = {
  BTCUSD: "BTC-USD",
  EURUSD: "EURUSD=X",
  GBPJPY: "GBPJPY=X",
  EURJPY: "EURJPY=X",
  AUDUSD: "AUDUSD=X",
  AUDJPY: "AUDJPY=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  USDCHF: "USDCHF=X",
  USDCAD: "USDCAD=X",
  NZDUSD: "NZDUSD=X",
  EURGBP: "EURGBP=X",
}

export interface RealCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// O Yahoo aceita 1m, 2m, 5m, 15m, 30m, 60m. Para 10m buscamos 5m e agregamos pares.
function intervalFor(tf: number): string {
  if (tf === 60) return "1m"
  if (tf === 300) return "5m"
  if (tf === 600) return "5m"
  return "1m"
}

// Velas de 1m so ficam disponiveis nos ultimos dias; o range acompanha o timeframe.
function rangeFor(interval: string): string {
  return interval === "1m" ? "1d" : "5d"
}

async function fetchYahooChart(symbol: string, interval: string, range: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}`

  // O Yahoo rejeita requisicoes sem User-Agent de navegador
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  })
  if (!r.ok) throw new Error(`yahoo ${r.status}`)

  const j = await r.json()
  const result = j?.chart?.result?.[0]
  if (!result) throw new Error("resposta sem resultado")
  return result
}

/** Converte a resposta do Yahoo em velas OHLC, descartando os buckets vazios */
function parseCandles(result: any): RealCandle[] {
  const timestamps: number[] = result?.timestamp ?? []
  const quote = result?.indicators?.quote?.[0]
  if (!quote) return []

  const candles: RealCandle[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i]
    const high = quote.high?.[i]
    const low = quote.low?.[i]
    const close = quote.close?.[i]
    // O Yahoo devolve null nos minutos sem negociacao
    if (
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue
    }
    candles.push({ time: timestamps[i], open, high, low, close })
  }
  return candles
}

/** Agrega velas de 5m em 10m, alinhadas a limites de 600s */
function aggregateTo10m(candles: RealCandle[]): RealCandle[] {
  const byBucket = new Map<number, RealCandle>()
  for (const c of candles) {
    const bucket = Math.floor(c.time / 600) * 600
    const existing = byBucket.get(bucket)
    if (!existing) {
      byBucket.set(bucket, { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close })
    } else {
      existing.high = Math.max(existing.high, c.high)
      existing.low = Math.min(existing.low, c.low)
      existing.close = c.close // as velas estao em ordem crescente
    }
  }
  return Array.from(byBucket.values()).sort((a, b) => a.time - b.time)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol") || "BTCUSD"
  const yahooSymbol = YAHOO_SYMBOLS[symbol]
  const type = searchParams.get("type") || "price"

  if (!yahooSymbol) {
    return NextResponse.json({ error: "symbol_unsupported" }, { status: 400 })
  }

  try {
    if (type === "price") {
      const result = await fetchYahooChart(yahooSymbol, "1m", "1d")
      // O preco de mercado vem no meta; o ultimo close serve de reserva
      const meta = result?.meta
      let price = Number(meta?.regularMarketPrice)
      if (!Number.isFinite(price)) {
        const candles = parseCandles(result)
        price = candles.length ? candles[candles.length - 1].close : Number.NaN
      }
      if (!Number.isFinite(price)) throw new Error("preco invalido")
      return NextResponse.json({ price })
    }

    // type === "candles"
    const tf = Number(searchParams.get("tf") || 60)
    const interval = intervalFor(tf)
    const result = await fetchYahooChart(yahooSymbol, interval, rangeFor(interval))
    let candles = parseCandles(result)
    if (tf === 600) candles = aggregateTo10m(candles)

    if (!candles.length) throw new Error("sem velas")
    return NextResponse.json({ candles })
  } catch (e) {
    console.log("[v0] market feed erro:", symbol, (e as Error).message)
    return NextResponse.json({ error: "feed_unavailable" }, { status: 502 })
  }
}
