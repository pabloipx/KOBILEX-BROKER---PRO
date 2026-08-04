import { NextResponse } from "next/server"
import { recordTick, getRecordedCandles } from "@/lib/price-engine/tick-recorder"

// Proxy para dados REAIS de mercado. Roda no servidor para evitar CORS e o bloqueio
// geografico que afeta algumas exchanges (ex.: Binance) a partir da Vercel.
//
// Duas fontes, cada uma no que faz melhor:
//
// 1) PRECO AO VIVO -> scanner do proprio TradingView. E a cotacao que o TradingView
//    exibe, com 5 casas decimais e em modo "streaming". Testado: o Yahoo entrega o
//    forex arredondado em 4 casas (ex.: 1.1535 no lugar de 1.15322) e congelado por
//    minutos, o que travava as velas e empatava as operacoes curtas.
//
// 2) HISTORICO DE VELAS -> Yahoo Finance, que devolve o OHLC real por periodo.
//    O scanner do TradingView so expoe o snapshot atual, sem historico.
export const dynamic = "force-dynamic"

interface SymbolInfo {
  /** Simbolo no Yahoo Finance, usado no historico de velas */
  yahoo: string
  /** Ticker no TradingView, usado no preco ao vivo */
  tv: string
  /** Mercado do scanner do TradingView */
  tvScan: "forex" | "crypto"
}

/**
 * O Yahoo so tem OHLC real de 1m para cripto. Para forex ele devolve o minuto achatado
 * (open=high=low=close), entao nesses pares as velas de 1m sao montadas com os ticks
 * reais que a plataforma acumula.
 */
function hasRealYahoo1m(info: SymbolInfo): boolean {
  return info.tvScan === "crypto"
}

// Mapeia o simbolo interno do motor -> simbolos das fontes reais.
// FX_IDC e a fonte de forex que o TradingView usa por padrao nos graficos publicos.
const SYMBOLS: Record<string, SymbolInfo> = {
  BTCUSD: { yahoo: "BTC-USD", tv: "COINBASE:BTCUSD", tvScan: "crypto" },
  EURUSD: { yahoo: "EURUSD=X", tv: "FX_IDC:EURUSD", tvScan: "forex" },
  GBPJPY: { yahoo: "GBPJPY=X", tv: "FX_IDC:GBPJPY", tvScan: "forex" },
  EURJPY: { yahoo: "EURJPY=X", tv: "FX_IDC:EURJPY", tvScan: "forex" },
  AUDUSD: { yahoo: "AUDUSD=X", tv: "FX_IDC:AUDUSD", tvScan: "forex" },
  AUDJPY: { yahoo: "AUDJPY=X", tv: "FX_IDC:AUDJPY", tvScan: "forex" },
  GBPUSD: { yahoo: "GBPUSD=X", tv: "FX_IDC:GBPUSD", tvScan: "forex" },
  USDJPY: { yahoo: "USDJPY=X", tv: "FX_IDC:USDJPY", tvScan: "forex" },
  USDCHF: { yahoo: "USDCHF=X", tv: "FX_IDC:USDCHF", tvScan: "forex" },
  USDCAD: { yahoo: "USDCAD=X", tv: "FX_IDC:USDCAD", tvScan: "forex" },
  NZDUSD: { yahoo: "NZDUSD=X", tv: "FX_IDC:NZDUSD", tvScan: "forex" },
  EURGBP: { yahoo: "EURGBP=X", tv: "FX_IDC:EURGBP", tvScan: "forex" },
}

export interface RealCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// =============================================
// PRECO AO VIVO (TradingView)
// =============================================

async function fetchTradingViewPrice(info: SymbolInfo): Promise<number> {
  const r = await fetch(`https://scanner.tradingview.com/${info.tvScan}/scan`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      symbols: { tickers: [info.tv], query: { types: [] } },
      columns: ["close"],
    }),
  })
  if (!r.ok) throw new Error(`tradingview ${r.status}`)

  const j = await r.json()
  const price = Number(j?.data?.[0]?.d?.[0])
  if (!Number.isFinite(price) || price <= 0) throw new Error("preco invalido no tradingview")
  return price
}

// =============================================
// HISTORICO DE VELAS (Yahoo Finance)
// =============================================

/**
 * O Yahoo aceita 1m, 2m, 5m, 15m, 30m, 60m. Buscamos o maior intervalo que divide o
 * timeframe pedido e agregamos, para que 10m (que o Yahoo nao tem) seja montado a
 * partir de velas reais de 5m em vez de cair silenciosamente em 1m.
 */
function sourceIntervalFor(tf: number): { interval: string; seconds: number } {
  if (tf % 900 === 0) return { interval: "15m", seconds: 900 }
  if (tf % 300 === 0) return { interval: "5m", seconds: 300 }
  return { interval: "1m", seconds: 60 }
}

// Velas de 1m so ficam disponiveis nos ultimos dias; o range acompanha o intervalo.
function rangeFor(interval: string): string {
  return interval === "1m" ? "1d" : "1mo"
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

/** Agrupa velas menores no timeframe pedido, preservando o OHLC real do periodo */
function aggregate(candles: RealCandle[], tf: number): RealCandle[] {
  const byBucket = new Map<number, RealCandle>()
  // As velas vem em ordem crescente, entao o ultimo close do bucket e o fechamento
  for (const c of candles) {
    const bucket = Math.floor(c.time / tf) * tf
    const existing = byBucket.get(bucket)
    if (!existing) {
      byBucket.set(bucket, { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close })
    } else {
      existing.high = Math.max(existing.high, c.high)
      existing.low = Math.min(existing.low, c.low)
      existing.close = c.close
    }
  }
  return Array.from(byBucket.values()).sort((a, b) => a.time - b.time)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol") || "BTCUSD"
  const info = SYMBOLS[symbol]
  const type = searchParams.get("type") || "price"

  if (!info) {
    return NextResponse.json({ error: "symbol_unsupported" }, { status: 400 })
  }

  try {
    if (type === "price") {
      let price: number
      try {
        price = await fetchTradingViewPrice(info)
      } catch {
        // Reserva: o meta do Yahoo. Menos preciso, mas mantem o ativo negociavel
        // se o scanner do TradingView estiver fora do ar.
        const result = await fetchYahooChart(info.yahoo, "1m", "1d")
        price = Number(result?.meta?.regularMarketPrice)
        if (!Number.isFinite(price)) {
          const candles = parseCandles(result)
          price = candles.length ? candles[candles.length - 1].close : Number.NaN
        }
      }
      if (!Number.isFinite(price) || price <= 0) throw new Error("preco invalido")

      // Alimenta o historico de 1m com este preco real. Nao usa await de proposito:
      // a cotacao do usuario nao pode esperar (nem falhar por causa da) gravacao.
      recordTick(symbol, price)

      return NextResponse.json({ price })
    }

    // type === "candles"
    const tf = Math.max(60, Number(searchParams.get("tf") || 60))

    // Forex em 1m: usa as velas construidas com os ticks reais acumulados, ja que o
    // Yahoo devolve o minuto sem corpo. Enquanto o historico proprio ainda e curto,
    // o Yahoo entra como reserva para o grafico nao abrir vazio.
    if (tf === 60 && !hasRealYahoo1m(info)) {
      const recorded = await getRecordedCandles(symbol)
      if (recorded.length >= 2) {
        return NextResponse.json({ candles: recorded, source: "ticks" })
      }
    }

    const { interval, seconds } = sourceIntervalFor(tf)
    const result = await fetchYahooChart(info.yahoo, interval, rangeFor(interval))
    let candles = parseCandles(result)
    if (tf !== seconds) candles = aggregate(candles, tf)

    if (!candles.length) throw new Error("sem velas")
    return NextResponse.json({ candles })
  } catch (e) {
    console.log("[v0] market feed erro:", symbol, (e as Error).message)
    return NextResponse.json({ error: "feed_unavailable" }, { status: 502 })
  }
}
