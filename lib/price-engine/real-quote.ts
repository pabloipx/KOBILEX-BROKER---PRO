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
  /** Simbolo no Yahoo Finance, usado no historico de velas */
  yahoo: string
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
  BTCUSD: { yahoo: "BTC-USD", tv: "COINBASE:BTCUSD", tvScan: "crypto", decimals: 2 },
  EURUSD: { yahoo: "EURUSD=X", tv: "OANDA:EURUSD", tvScan: "forex", decimals: 5 },
  GBPJPY: { yahoo: "GBPJPY=X", tv: "OANDA:GBPJPY", tvScan: "forex", decimals: 3 },
  EURJPY: { yahoo: "EURJPY=X", tv: "OANDA:EURJPY", tvScan: "forex", decimals: 3 },
  AUDUSD: { yahoo: "AUDUSD=X", tv: "OANDA:AUDUSD", tvScan: "forex", decimals: 5 },
  AUDJPY: { yahoo: "AUDJPY=X", tv: "OANDA:AUDJPY", tvScan: "forex", decimals: 3 },
  GBPUSD: { yahoo: "GBPUSD=X", tv: "OANDA:GBPUSD", tvScan: "forex", decimals: 5 },
  USDJPY: { yahoo: "USDJPY=X", tv: "OANDA:USDJPY", tvScan: "forex", decimals: 3 },
  USDCHF: { yahoo: "USDCHF=X", tv: "OANDA:USDCHF", tvScan: "forex", decimals: 5 },
  USDCAD: { yahoo: "USDCAD=X", tv: "OANDA:USDCAD", tvScan: "forex", decimals: 5 },
  NZDUSD: { yahoo: "NZDUSD=X", tv: "OANDA:NZDUSD", tvScan: "forex", decimals: 5 },
  EURGBP: { yahoo: "EURGBP=X", tv: "OANDA:EURGBP", tvScan: "forex", decimals: 5 },
}

/** Arredonda para a precisao real do par, removendo o ruido de ponto flutuante do Yahoo. */
export function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals))
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
