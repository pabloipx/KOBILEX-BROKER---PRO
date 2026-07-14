"use client"

/**
 * Feed CLIENT-SIDE de precos reais. Faz polling do proxy /api/market/crypto (que busca da
 * Coinbase no servidor) e escreve os valores no real-price-store, de onde o motor de precos
 * le de forma sincrona. Ref-counted por simbolo para nao duplicar timers.
 */

import {
  REAL_FEED_SYMBOLS,
  setRealPrice,
  setRealCandles,
  pushRealTick,
  seedRealHistory,
} from "./real-price-store"

interface FeedState {
  priceTimer: ReturnType<typeof setInterval> | null
  candleTimer: ReturnType<typeof setInterval> | null
  tf: number
  refs: number
}

const feeds = new Map<string, FeedState>()

async function pollPrice(symbol: string, tf: number) {
  try {
    const r = await fetch(`/api/market/crypto?type=price&symbol=${symbol}`, { cache: "no-store" })
    if (!r.ok) return
    const j = await r.json()
    if (!Number.isFinite(j?.price)) return
    const info = REAL_FEED_SYMBOLS[symbol]
    setRealPrice(symbol, j.price)
    // Forex nao tem candles historicos na API: construimos as velas a partir dos ticks reais.
    if (info?.kind === "forex") {
      seedRealHistory(symbol, tf, j.price, info.decimals)
      pushRealTick(symbol, tf, j.price, info.decimals)
    }
  } catch {}
}

async function pollCandles(symbol: string, tf: number) {
  try {
    const r = await fetch(`/api/market/crypto?type=candles&symbol=${symbol}&tf=${tf}`, { cache: "no-store" })
    if (!r.ok) return
    const j = await r.json()
    if (Array.isArray(j?.candles) && j.candles.length > 0) setRealCandles(symbol, tf, j.candles)
  } catch {}
}

/**
 * Garante que o feed do simbolo esteja rodando para o timeframe atual. Retorna uma funcao de
 * cleanup (decrementa o ref-count e para os timers quando ninguem mais usa).
 */
export function ensureRealFeed(symbol: string, tf: number): () => void {
  if (!REAL_FEED_SYMBOLS[symbol]) return () => {}

  const isCrypto = REAL_FEED_SYMBOLS[symbol].kind === "crypto"

  let s = feeds.get(symbol)
  if (!s) {
    s = { priceTimer: null, candleTimer: null, tf, refs: 0 }
    feeds.set(symbol, s)
    // Busca imediata + polling continuo do preco (cripto e forex)
    pollPrice(symbol, tf)
    s.priceTimer = setInterval(() => {
      const st = feeds.get(symbol)
      if (st) pollPrice(symbol, st.tf)
    }, 1500)
    // Candles historicos reais so existem para cripto (Coinbase Exchange)
    if (isCrypto) {
      pollCandles(symbol, tf)
      s.candleTimer = setInterval(() => {
        const st = feeds.get(symbol)
        if (st) pollCandles(symbol, st.tf)
      }, 15000)
    }
  }

  // Timeframe mudou: recarrega as velas do novo tf imediatamente
  if (s.tf !== tf) {
    s.tf = tf
    if (isCrypto) pollCandles(symbol, tf)
  }

  s.refs++

  return () => {
    const st = feeds.get(symbol)
    if (!st) return
    st.refs--
    if (st.refs <= 0) {
      if (st.priceTimer) clearInterval(st.priceTimer)
      if (st.candleTimer) clearInterval(st.candleTimer)
      feeds.delete(symbol)
    }
  }
}
