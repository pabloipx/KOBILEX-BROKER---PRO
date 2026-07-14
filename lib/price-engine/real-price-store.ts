/**
 * Store SINCRONO e compartilhado para precos REAIS de mercado (ex.: BTC via Coinbase).
 *
 * E um modulo puro (apenas um Map em memoria) — sem fetch, sem efeitos colaterais — por isso
 * pode ser importado com seguranca tanto no servidor quanto no cliente e, principalmente,
 * dentro do motor de precos deterministico (multi-asset-engine), que le daqui de forma
 * sincrona a cada frame. Quem PREENCHE este store e o real-price-feed (client), que faz o
 * polling da API real e escreve os valores aqui.
 */

export interface RealCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface Entry {
  price: number
  priceTs: number
  candles: Map<number, RealCandle[]> // timeframe(s) -> candles (ordem crescente)
  revision: number
}

const store = new Map<string, Entry>()

export interface RealFeedInfo {
  /** Produto na Coinbase (ex.: "BTC-USD", "EUR-USD") */
  product: string
  /** "crypto" tem candles historicos reais; "forex" tem apenas preco (velas sao construidas por tick) */
  kind: "crypto" | "forex"
  decimals: number
}

// Simbolos internos do motor (mercado aberto) que devem usar feed REAL.
// As versoes OTC (ex.: "BTCUSD_OTC") continuam sinteticas de proposito.
export const REAL_FEED_SYMBOLS: Record<string, RealFeedInfo> = {
  BTCUSD: { product: "BTC-USD", kind: "crypto", decimals: 2 },
  EURUSD: { product: "EUR-USD", kind: "forex", decimals: 5 },
  GBPJPY: { product: "GBP-JPY", kind: "forex", decimals: 3 },
  EURJPY: { product: "EUR-JPY", kind: "forex", decimals: 3 },
  AUDUSD: { product: "AUD-USD", kind: "forex", decimals: 5 },
  AUDJPY: { product: "AUD-JPY", kind: "forex", decimals: 3 },
}

export function isRealSymbol(symbol: string): boolean {
  return !!REAL_FEED_SYMBOLS[symbol]
}

function ensure(symbol: string): Entry {
  let e = store.get(symbol)
  if (!e) {
    e = { price: 0, priceTs: 0, candles: new Map(), revision: 0 }
    store.set(symbol, e)
  }
  return e
}

export function setRealPrice(symbol: string, price: number): void {
  const e = ensure(symbol)
  e.price = price
  e.priceTs = Date.now()
  e.revision++
}

export function setRealCandles(symbol: string, tf: number, candles: RealCandle[]): void {
  const e = ensure(symbol)
  e.candles.set(tf, candles)
  e.revision++
}

const MAX_REAL_CANDLES = 400

/**
 * Constroi/atualiza as velas REAIS a partir de um tick de preco ao vivo. Usado para forex,
 * onde nao ha endpoint de candles historicos — as velas nascem do proprio fluxo de precos.
 */
export function pushRealTick(symbol: string, tf: number, price: number, decimals: number): void {
  const e = ensure(symbol)
  const arr = e.candles.get(tf) || []
  const bucket = Math.floor(Date.now() / 1000 / tf) * tf
  const r = (n: number) => Number(n.toFixed(decimals))
  const last = arr[arr.length - 1]
  if (!last || last.time < bucket) {
    const open = last ? last.close : r(price)
    arr.push({ time: bucket, open, high: Math.max(open, r(price)), low: Math.min(open, r(price)), close: r(price) })
    while (arr.length > MAX_REAL_CANDLES) arr.shift()
  } else if (last.time === bucket) {
    last.high = Math.max(last.high, r(price))
    last.low = Math.min(last.low, r(price))
    last.close = r(price)
  }
  e.candles.set(tf, arr)
  e.revision++
}

/**
 * Gera um backfill inicial de velas ancorado no preco real (a ultima vela fecha exatamente no
 * preco atual). So roda uma vez por timeframe, quando ainda nao existe historico. Isso evita
 * que o grafico abra vazio enquanto os ticks reais nao se acumulam; dai em diante o historico
 * passa a ser 100% construido a partir dos precos reais recebidos.
 */
export function seedRealHistory(symbol: string, tf: number, price: number, decimals: number): void {
  const e = ensure(symbol)
  if (e.candles.get(tf)?.length) return
  const N = 80
  const nowBucket = Math.floor(Date.now() / 1000 / tf) * tf
  const amp = price * 0.0006 // ~0.06% de variacao por vela (perfil calmo de forex)
  const r = (n: number) => Number(n.toFixed(decimals))
  const out: RealCandle[] = []
  let close = price
  // Constroi de tras para frente: a ultima vela (mais recente) fecha no preco real.
  for (let i = N - 1; i >= 0; i--) {
    const open = close + (Math.random() - 0.5) * amp
    const high = Math.max(open, close) + Math.random() * amp * 0.3
    const low = Math.min(open, close) - Math.random() * amp * 0.3
    out[i] = { time: nowBucket - (N - 1 - i) * tf, open: r(open), high: r(high), low: r(low), close: r(close) }
    close = open // continuidade: fechamento da vela anterior = abertura desta
  }
  e.candles.set(tf, out)
  e.revision++
}

export function getRealPrice(symbol: string): number {
  return store.get(symbol)?.price || 0
}

// Considera o preco "fresco" apenas se recebido nos ultimos 30s (evita usar dado velho se o
// feed cair — nesse caso o motor volta ao sintetico).
export function hasRealPrice(symbol: string): boolean {
  const e = store.get(symbol)
  return !!e && e.price > 0 && Date.now() - e.priceTs < 30000
}

export function getRealCandles(symbol: string, tf: number): RealCandle[] | null {
  return store.get(symbol)?.candles.get(tf) || null
}

export function getRealRevision(symbol: string): number {
  return store.get(symbol)?.revision || 0
}
