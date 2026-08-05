/**
 * Cotacao REAL de mercado no servidor. Fonte unica de verdade para o grafico e, principalmente,
 * para a LIQUIDACAO das operacoes de mercado aberto.
 *
 * Por que este modulo existe: a liquidacao usava `generatePriceAtTime()`, que sintetizava um
 * preco em torno de 1.085 a partir de senos e de um pseudo-aleatorio com semente no relogio —
 * e ignorava o simbolo, entao BTCUSD, USDJPY e EURUSD eram todos liquidados na mesma serie
 * inventada de ~1.08. O ganho/perda do usuario nao tinha relacao nem com o mercado nem com o
 * grafico que ele estava vendo.
 *
 * Aqui nada e sintetizado. O preco vem da fonte de mercado (OANDA/Coinbase via TradingView) e,
 * quando ela nao responde, do historico de ticks reais que a propria plataforma gravou. Se
 * nenhuma das duas tiver preco, a funcao devolve `null` — e quem chama deve se recusar a
 * liquidar, em vez de inventar um numero.
 */

import { createAdminClient } from "@/lib/supabase/admin"

export interface SymbolInfo {
  /** Simbolo no Yahoo Finance, usado como reserva do historico de velas */
  yahoo: string
  /** Simbolo na Twelve Data, fonte primaria do OHLC real (ver fetchTwelveDataCandles) */
  td: string
  /** Ticker no TradingView, usado no preco ao vivo */
  tv: string
  /** Mercado do scanner do TradingView */
  tvScan: "forex" | "crypto"
  /** Casas decimais do par. O Yahoo devolve float32 alargado (1.1531364917755127). */
  decimals: number
}

/**
 * Mapa dos ativos de mercado aberto -> simbolos das fontes reais.
 *
 * A fonte de forex e OANDA, e nao FX_IDC. FX_IDC e uma fonte de REFERENCIA (taxa indicativa,
 * nao negociada): medida aqui, devolve o EUR/USD com 4 casas decimais e congelado — 1 unico
 * valor em 12 leituras, ou seja, 0 pip de variacao. Com preco parado e sem a casa do pip, as
 * velas nasciam sem corpo e as operacoes curtas empatavam.
 *
 * OANDA e uma corretora de verdade: cotacao negociavel com 5 casas decimais (1.15542, a mesma
 * precisao do TradingView) e movimento real — na mesma medicao, 8 pips de amplitude em 60s.
 */
export const SYMBOLS: Record<string, SymbolInfo> = {
  BTCUSD: { yahoo: "BTC-USD", td: "BTC/USD", tv: "COINBASE:BTCUSD", tvScan: "crypto", decimals: 2 },
  EURUSD: { yahoo: "EURUSD=X", td: "EUR/USD", tv: "OANDA:EURUSD", tvScan: "forex", decimals: 5 },
  GBPJPY: { yahoo: "GBPJPY=X", td: "GBP/JPY", tv: "OANDA:GBPJPY", tvScan: "forex", decimals: 3 },
  EURJPY: { yahoo: "EURJPY=X", td: "EUR/JPY", tv: "OANDA:EURJPY", tvScan: "forex", decimals: 3 },
  AUDUSD: { yahoo: "AUDUSD=X", td: "AUD/USD", tv: "OANDA:AUDUSD", tvScan: "forex", decimals: 5 },
  AUDJPY: { yahoo: "AUDJPY=X", td: "AUD/JPY", tv: "OANDA:AUDJPY", tvScan: "forex", decimals: 3 },
  GBPUSD: { yahoo: "GBPUSD=X", td: "GBP/USD", tv: "OANDA:GBPUSD", tvScan: "forex", decimals: 5 },
  USDJPY: { yahoo: "USDJPY=X", td: "USD/JPY", tv: "OANDA:USDJPY", tvScan: "forex", decimals: 3 },
  USDCHF: { yahoo: "USDCHF=X", td: "USD/CHF", tv: "OANDA:USDCHF", tvScan: "forex", decimals: 5 },
  USDCAD: { yahoo: "USDCAD=X", td: "USD/CAD", tv: "OANDA:USDCAD", tvScan: "forex", decimals: 5 },
  NZDUSD: { yahoo: "NZDUSD=X", td: "NZD/USD", tv: "OANDA:NZDUSD", tvScan: "forex", decimals: 5 },
  EURGBP: { yahoo: "EURGBP=X", td: "EUR/GBP", tv: "OANDA:EURGBP", tvScan: "forex", decimals: 5 },
}

/** Arredonda para a precisao real do par, removendo o ruido de ponto flutuante do Yahoo. */
export function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals))
}

export interface RealCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// =============================================
// OHLC REAL (Twelve Data)
// =============================================

/**
 * Fonte PRIMARIA do OHLC de mercado aberto.
 *
 * Por que trocar o Yahoo: medido nesta base, o Yahoo devolve o forex de 1m com
 * open=high=low=close em 1242 de 1242 velas — 100% achatado. Velas sem maxima e sem minima nao
 * tem pavio nem corpo, e e exatamente por isso que o grafico nunca ficava igual ao do mercado
 * real, por mais que o preco ao vivo estivesse correto. O Yahoo publica uma taxa indicativa
 * amostrada uma vez por minuto, nao o intervalo negociado.
 *
 * A Twelve Data devolve o OHLC agregado de verdade (0 velas achatadas na mesma medicao, 5 casas
 * decimais), que e o mesmo tipo de dado que o TradingView desenha.
 *
 * Requer TWELVE_DATA_API_KEY. Sem a chave a funcao devolve `null` e o chamador cai no Yahoo:
 * o grafico continua funcionando, apenas menos fiel.
 */
const TD_INTERVALS: Record<number, { interval: string; seconds: number }> = {
  60: { interval: "1min", seconds: 60 },
  300: { interval: "5min", seconds: 300 },
  // A Twelve Data nao tem 10min: pedimos 5min e agregamos, preservando o OHLC real.
  600: { interval: "5min", seconds: 300 },
  900: { interval: "15min", seconds: 900 },
}

// Cache do OHLC por (simbolo, intervalo), compartilhado por todos os usuarios.
//
// Sem ele o plano gratuito quebra na hora: o limite e de 8 requisicoes por minuto, e cada
// cliente com o grafico aberto recarrega velas a cada poucos segundos. Com o cache a fonte e
// consultada no maximo uma vez por intervalo, independente de haver 1 ou 10.000 usuarios.
//
// O TTL de 15s nao reduz a fidelidade: a vela em formacao so muda de fato a cada minuto, e o
// preco ao vivo (que se move a cada segundo) vem por outro caminho, o getLivePrice.
const CANDLE_TTL_MS = 15_000
const candleCache = new Map<string, { candles: RealCandle[]; at: number }>()

export async function fetchTwelveDataCandles(
  symbol: string,
  tf: number,
): Promise<RealCandle[] | null> {
  const info = SYMBOLS[symbol]
  const spec = TD_INTERVALS[tf]
  const key = process.env.TWELVE_DATA_API_KEY
  if (!info || !spec || !key) return null

  const cacheKey = `${symbol}:${spec.interval}`
  const hit = candleCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CANDLE_TTL_MS) return hit.candles

  try {
    // outputsize cobre as ~240 velas que o grafico mostra mesmo quando o tf pedido exige
    // agregacao (600s = 2 velas de 5min por periodo).
    const url =
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(info.td)}` +
      `&interval=${spec.interval}&outputsize=500&timezone=UTC&apikey=${key}`

    const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } })
    if (!r.ok) throw new Error(`twelvedata ${r.status}`)

    const j = await r.json()
    // A API responde 200 com {status:"error"} em limite excedido e chave invalida.
    if (j?.status === "error") throw new Error(String(j?.message).slice(0, 120))

    const values: any[] = j?.values ?? []
    const candles: RealCandle[] = []
    for (const v of values) {
      const open = Number(v.open)
      const high = Number(v.high)
      const low = Number(v.low)
      const close = Number(v.close)
      // "2026-08-06 05:40:00" em UTC (timezone=UTC acima). O "T"/"Z" evita que o Node
      // interprete como hora local do servidor e desloque a serie inteira.
      const time = Math.floor(new Date(`${String(v.datetime).replace(" ", "T")}Z`).getTime() / 1000)
      if (![open, high, low, close, time].every(Number.isFinite)) continue
      candles.push({
        time,
        open: round(open, info.decimals),
        high: round(high, info.decimals),
        low: round(low, info.decimals),
        close: round(close, info.decimals),
      })
    }
    if (candles.length < 2) throw new Error("resposta sem velas")

    // A Twelve Data devolve do mais recente para o mais antigo; o grafico espera crescente.
    candles.sort((a, b) => a.time - b.time)

    candleCache.set(cacheKey, { candles, at: Date.now() })
    return candles
  } catch (e) {
    console.log("[v0] twelvedata erro:", symbol, spec.interval, (e as Error).message)
    // Serve o cache vencido em vez de deixar o grafico sem dado: uma vela de 15s atras e
    // infinitamente melhor que cair na serie achatada do Yahoo.
    return hit?.candles ?? null
  }
}

/** Cotacao ao vivo direto da fonte de mercado. Lanca se a fonte nao responder. */
export async function fetchTradingViewPrice(info: SymbolInfo): Promise<number> {
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

// Cache curto do preco upstream, compartilhado por todos os usuarios.
//
// Sem ele, a carga na fonte cresce com o numero de usuarios: cada cliente que consulta o preco
// dispararia uma chamada propria ao TradingView, o que levaria a bloqueio por excesso de
// requisicoes justamente com a plataforma cheia. Com o cache, a fonte e consultada no maximo
// uma vez por segundo por simbolo, independente de haver 1 ou 10.000 usuarios conectados.
//
// O TTL nao reduz a fidelidade: a cotacao de forex a que temos acesso e renovada a cada ~20s,
// entao 1s de cache esta bem abaixo da resolucao real da fonte.
const PRICE_TTL_MS = 1000
const priceCache = new Map<string, { price: number; at: number }>()

/** Preco ao vivo com cache de 1s. Devolve `null` se a fonte falhar. */
export async function getLivePrice(symbol: string): Promise<number | null> {
  const info = SYMBOLS[symbol]
  if (!info) return null

  const hit = priceCache.get(symbol)
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.price

  try {
    const price = round(await fetchTradingViewPrice(info), info.decimals)
    priceCache.set(symbol, { price, at: Date.now() })
    return price
  } catch {
    return null
  }
}

/** Ultimo preco real GRAVADO pela plataforma no minuto de `atMs` (ou no minuto anterior mais proximo). */
async function getRecordedPriceAt(symbol: string, atMs: number): Promise<number | null> {
  // createAdminClient lanca quando as credenciais nao estao configuradas.
  try {
    const bucket = Math.floor(atMs / 1000 / 60) * 60
    const { data, error } = await createAdminClient()
      .from("market_candles_1m")
      .select("close")
      .eq("symbol", symbol)
      .lte("bucket_time", bucket)
      .order("bucket_time", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    const price = Number(data.close)
    return Number.isFinite(price) && price > 0 ? price : null
  } catch {
    return null
  }
}

/**
 * Preco REAL de mercado do ativo no instante `atMs`, para liquidar uma operacao.
 *
 * Ordem de preferencia:
 *  1. Cotacao ao vivo, quando o instante pedido e recente (a operacao acabou de vencer).
 *  2. Historico de ticks reais gravado pela plataforma — auditavel e igual para todos os
 *     usuarios, o que tambem cobre a liquidacao atrasada (ex.: servidor reiniciou).
 *
 * Devolve `null` quando nao existe preco real. Quem chama NAO deve inventar um valor: sem
 * preco de mercado nao ha como decidir ganho ou perda de forma justa.
 */
export async function getRealPriceAt(symbol: string, atMs: number): Promise<number | null> {
  if (!SYMBOLS[symbol]) return null

  // "Recente" = o vencimento acabou de ocorrer, entao a cotacao atual ainda representa o
  // momento da liquidacao. Passado disso, so o historico gravado responde pelo instante certo.
  if (Date.now() - atMs <= 90_000) {
    const live = await getLivePrice(symbol)
    if (live !== null) return live
  }

  return getRecordedPriceAt(symbol, atMs)
}
