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
  /** Simbolo no Yahoo Finance (ex.: "BTC-USD", "EURUSD=X") */
  product: string
  decimals: number
}

// Simbolos internos do motor (mercado aberto) que devem usar feed REAL.
// As versoes OTC (ex.: "BTCUSD_OTC") continuam sinteticas de proposito.
// Todos possuem velas OHLC reais no Yahoo Finance, inclusive os pares de forex.
export const REAL_FEED_SYMBOLS: Record<string, RealFeedInfo> = {
  BTCUSD: { product: "BTC-USD", decimals: 2 },
  EURUSD: { product: "EURUSD=X", decimals: 5 },
  GBPJPY: { product: "GBPJPY=X", decimals: 3 },
  EURJPY: { product: "EURJPY=X", decimals: 3 },
  AUDUSD: { product: "AUDUSD=X", decimals: 5 },
  AUDJPY: { product: "AUDJPY=X", decimals: 3 },
  // Majors reais adicionais
  GBPUSD: { product: "GBPUSD=X", decimals: 5 },
  USDJPY: { product: "USDJPY=X", decimals: 3 },
  USDCHF: { product: "USDCHF=X", decimals: 5 },
  USDCAD: { product: "USDCAD=X", decimals: 5 },
  NZDUSD: { product: "NZDUSD=X", decimals: 5 },
  EURGBP: { product: "EURGBP=X", decimals: 5 },
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
 * Atualiza a vela EM FORMACAO com o ultimo preco real recebido. O historico completo vem do
 * endpoint de candles (a cada 15s), enquanto o preco chega a cada 1,5s — esta funcao mantem a
 * vela atual acompanhando o preco ao vivo entre duas cargas de historico. Todos os valores sao
 * reais: nada aqui e sintetizado.
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
