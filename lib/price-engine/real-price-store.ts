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

// Simbolos internos do motor que devem usar feed REAL, e o produto correspondente no feed.
export const REAL_FEED_SYMBOLS: Record<string, string> = {
  BTCUSD: "BTCUSD", // mercado aberto (a versao OTC "BTCUSD_OTC" continua sintetica)
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
