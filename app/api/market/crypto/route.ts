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
  /** Casas decimais do par. O Yahoo devolve float32 alargado (1.1531364917755127). */
  decimals: number
}

/** Arredonda para a precisao real do par, removendo o ruido de ponto flutuante do Yahoo. */
function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals))
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
  BTCUSD: { yahoo: "BTC-USD", tv: "COINBASE:BTCUSD", tvScan: "crypto", decimals: 2 },
  EURUSD: { yahoo: "EURUSD=X", tv: "FX_IDC:EURUSD", tvScan: "forex", decimals: 5 },
  GBPJPY: { yahoo: "GBPJPY=X", tv: "FX_IDC:GBPJPY", tvScan: "forex", decimals: 3 },
  EURJPY: { yahoo: "EURJPY=X", tv: "FX_IDC:EURJPY", tvScan: "forex", decimals: 3 },
  AUDUSD: { yahoo: "AUDUSD=X", tv: "FX_IDC:AUDUSD", tvScan: "forex", decimals: 5 },
  AUDJPY: { yahoo: "AUDJPY=X", tv: "FX_IDC:AUDJPY", tvScan: "forex", decimals: 3 },
  GBPUSD: { yahoo: "GBPUSD=X", tv: "FX_IDC:GBPUSD", tvScan: "forex", decimals: 5 },
  USDJPY: { yahoo: "USDJPY=X", tv: "FX_IDC:USDJPY", tvScan: "forex", decimals: 3 },
  USDCHF: { yahoo: "USDCHF=X", tv: "FX_IDC:USDCHF", tvScan: "forex", decimals: 5 },
  USDCAD: { yahoo: "USDCAD=X", tv: "FX_IDC:USDCAD", tvScan: "forex", decimals: 5 },
  NZDUSD: { yahoo: "NZDUSD=X", tv: "FX_IDC:NZDUSD", tvScan: "forex", decimals: 5 },
  EURGBP: { yahoo: "EURGBP=X", tv: "FX_IDC:EURGBP", tvScan: "forex", decimals: 5 },
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

/**
 * Monta as velas de 1m do forex combinando as duas fontes reais disponiveis.
 *
 * O problema: o Yahoo tem a LINHA DO TEMPO completa de 1m (um ponto por minuto, sem
 * buracos) mas com o minuto achatado — open=high=low=close. O historico de ticks tem
 * CORPO real (maxima/minima observadas) mas so nos minutos em que alguem estava usando
 * a plataforma, o que deixa vaos e velas sem corpo no grafico.
 *
 * A combinacao usa cada fonte no que ela tem de real:
 *  - o Yahoo define a sequencia de minutos e o fechamento real de cada um;
 *  - o open encadeia no fechamento do minuto anterior, entao o corpo reflete o movimento
 *    real entre um minuto e o seguinte (e nao um valor inventado);
 *  - a maxima/minima dos ticks observados expande o corpo quando ha registro.
 *
 * Resultado: serie continua, sem vaos, com todos os valores vindos de preco real.
 */
function buildMinuteCandles(
  yahoo: RealCandle[],
  recorded: RealCandle[],
  decimals: number,
): RealCandle[] {
  const byBucket = new Map<number, RealCandle>()
  for (const c of recorded) byBucket.set(c.time, c)

  // Minutos conhecidos: os do Yahoo mais os ticks recentes (o Yahoo atrasa alguns minutos).
  const minutes = new Set<number>()
  for (const c of yahoo) minutes.add(Math.floor(c.time / 60) * 60)
  for (const c of recorded) minutes.add(c.time)
  if (!minutes.size) return []

  const yahooClose = new Map<number, number>()
  for (const c of yahoo) yahooClose.set(Math.floor(c.time / 60) * 60, c.close)

  const sorted = Array.from(minutes).sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const out: RealCandle[] = []
  let prevClose = byBucket.get(first)?.open ?? yahooClose.get(first) ?? 0

  // Percorre minuto a minuto para nao deixar buracos: um minuto sem dado nenhum vira uma
  // vela de continuidade no ultimo preco real conhecido (nao houve preco novo observado).
  for (let t = first; t <= last; t += 60) {
    const tick = byBucket.get(t)
    const close = tick?.close ?? yahooClose.get(t) ?? prevClose
    const open = prevClose || close

    let high = Math.max(open, close)
    let low = Math.min(open, close)
    if (tick) {
      high = Math.max(high, tick.high)
      low = Math.min(low, tick.low)
    }

    out.push({
      time: t,
      open: round(open, decimals),
      high: round(high, decimals),
      low: round(low, decimals),
      close: round(close, decimals),
    })
    prevClose = close
  }

  return out
}

/**
 * Preenche periodos ausentes na serie. O Yahoo devolve null nos periodos sem negociacao e
 * esses buracos aparecem no grafico como vaos. O periodo vazio vira uma vela de continuidade
 * no ultimo fechamento real: nao houve preco novo, entao nao houve movimento.
 * O OHLC real das velas existentes e preservado.
 */
function fillGaps(candles: RealCandle[], tf: number): RealCandle[] {
  if (candles.length < 2) return candles

  const out: RealCandle[] = [candles[0]]
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]
    for (let t = prev.time + tf; t < candles[i].time; t += tf) {
      out.push({ time: t, open: prev.close, high: prev.close, low: prev.close, close: prev.close })
    }
    out.push(candles[i])
  }
  return out
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

    // Forex em 1m: combina a linha do tempo do Yahoo (continua, com o fechamento real de
    // cada minuto) com o corpo dos ticks observados. Sozinha, nenhuma das duas serve: o
    // Yahoo vem achatado e os ticks vem com vaos.
    if (tf === 60 && !hasRealYahoo1m(info)) {
      const [yahoo, recorded] = await Promise.all([
        fetchYahooChart(info.yahoo, "1m", "1d").then(parseCandles).catch(() => [] as RealCandle[]),
        getRecordedCandles(symbol).catch(() => [] as RealCandle[]),
      ])

      const merged = buildMinuteCandles(yahoo, recorded, info.decimals)
      if (merged.length >= 2) {
        return NextResponse.json({ candles: merged.slice(-240), source: "merged" })
      }
    }

    const { interval } = sourceIntervalFor(tf)
    const result = await fetchYahooChart(info.yahoo, interval, rangeFor(interval))
    // Sempre agrega, mesmo quando o intervalo da fonte ja e o pedido: alem de agrupar, o
    // aggregate alinha os periodos e junta duplicatas. O Yahoo devolve a ultima vela (a do
    // periodo em formacao) com timestamp fora da grade, o que aparecia no grafico como um
    // vao e uma vela comprimida na borda.
    let candles = aggregate(parseCandles(result), tf)
    candles = fillGaps(candles, tf)

    if (!candles.length) throw new Error("sem velas")

    // O Yahoo devolve float32 alargado (64256.01171875); a UI espera a precisao do par.
    const rounded = candles.map(c => ({
      time: c.time,
      open: round(c.open, info.decimals),
      high: round(c.high, info.decimals),
      low: round(c.low, info.decimals),
      close: round(c.close, info.decimals),
    }))
    return NextResponse.json({ candles: rounded })
  } catch (e) {
    console.log("[v0] market feed erro:", symbol, (e as Error).message)
    return NextResponse.json({ error: "feed_unavailable" }, { status: 502 })
  }
}
