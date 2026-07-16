"use client"

import { useEffect, useState, useRef } from "react"
import { multiAssetEngine, OTC_ASSETS, type OTCCandle } from "@/lib/price-engine/multi-asset-engine"
import { ensureRealFeed } from "@/lib/price-engine/real-price-feed"
import { hasRealPrice, getRealRevision, isRealSymbol } from "@/lib/price-engine/real-price-store"
import { ensureManipulationSync } from "@/lib/price-engine/manipulation-sync"

/**
 * useGlobalOTC — feed de preco 100% CLIENT-SIDE.
 *
 * O motor de precos (multiAssetEngine) e puro e deterministico: para um dado (ativo, tempo)
 * ele sempre produz o mesmo preco/velas, no cliente ou no servidor. Por isso calculamos tudo
 * localmente no navegador via requestAnimationFrame — SEM chamadas de rede.
 *
 * Isso elimina a causa raiz do "grafico travado / preco em ...": antes o app dependia dos
 * endpoints serverless (/api/global/state), que sofrem cold start e latencia em producao,
 * segurando o preco em 0 ("...") por varios segundos. Agora o grafico aparece carregado
 * instantaneamente na entrada e a troca de ativo e imediata, sem delay e sem congelamento.
 *
 * A liquidacao de operacoes continua no servidor (usando o mesmo motor deterministico),
 * entao os precos exibidos e os de liquidacao permanecem consistentes.
 */
export function useGlobalOTC(symbol: string, timeframe: 60 | 300 | 600) {
  const validSymbol = OTC_ASSETS.find((a) => a.symbol === symbol)?.symbol || "EURUSD_OTC"
  const asset = OTC_ASSETS.find((a) => a.symbol === validSymbol) || OTC_ASSETS[0]

  // Contador para forcar re-render a uma taxa controlada (nao usamos setState no rAF direto).
  const [, setTick] = useState(0)

  const smoothRef = useRef(0)
  const candlesRef = useRef<OTCCandle[]>([])
  const liveCandleRef = useRef<OTCCandle | null>(null)
  const candleStartRef = useRef(0)
  const lastUiRef = useRef(0)
  const mountedRef = useRef(true)
  const keyRef = useRef("")
  const realRevRef = useRef(-1)

  // Inicializacao SINCRONA durante o render sempre que o ativo/timeframe muda. Como as funcoes
  // do motor sao puras e deterministicas, calcular aqui e seguro e garante que os dados
  // retornados ja estao corretos NO MESMO render — troca instantanea, sem flash nem delay.
  const key = `${validSymbol}_${timeframe}`
  if (keyRef.current !== key) {
    keyRef.current = key
    candlesRef.current = multiAssetEngine.getCandles(validSymbol, timeframe)
    smoothRef.current = multiAssetEngine.getCurrentPrice(validSymbol)
    liveCandleRef.current = multiAssetEngine.getCurrentCandle(validSymbol, timeframe)
    candleStartRef.current = Math.floor(Date.now() / 1000 / timeframe) * timeframe
  }

  // Inicia (e mantem) o feed de preco REAL para simbolos de mercado aberto (ex.: BTC/USD).
  // Para os demais ativos e um no-op. O feed escreve no store, que o motor le sincronamente.
  useEffect(() => {
    if (!isRealSymbol(validSymbol)) return
    const stop = ensureRealFeed(validSymbol, timeframe)
    return stop
  }, [validSymbol, timeframe])

  // Sincroniza as manipulacoes do admin (singleton, roda uma unica vez por aba).
  useEffect(() => {
    ensureManipulationSync()
  }, [])

  // Loop de animacao: recalcula o preco vivo deterministicamente a cada frame.
  useEffect(() => {
    mountedRef.current = true
    let raf = 0
    let lastFrame = 0
    realRevRef.current = -1

    const step = () => {
      if (!mountedRef.current) return
      const nowMs = Date.now()
      const now = nowMs / 1000
      const cs = Math.floor(now / timeframe) * timeframe

      // Cruzou o limite de uma nova vela: reconstroi o historico recente (barato, ~30 velas).
      if (cs !== candleStartRef.current) {
        candleStartRef.current = cs
        candlesRef.current = multiAssetEngine.getCandles(validSymbol, timeframe)
      }

      // Dados reais chegaram/atualizaram: reconstroi o historico com as velas reais.
      const rev = getRealRevision(validSymbol)
      if (rev !== realRevRef.current) {
        realRevRef.current = rev
        candlesRef.current = multiAssetEngine.getCandles(validSymbol, timeframe)
      }

      const target = multiAssetEngine.getCurrentPrice(validSymbol)
      // Suavizacao leve (o motor ja e continuo, isto so remove micro-degraus entre frames).
      if (smoothRef.current <= 0) smoothRef.current = target
      else smoothRef.current += (target - smoothRef.current) * 0.25

      const price = Number(smoothRef.current.toFixed(asset.decimals))
      const cc = multiAssetEngine.getCurrentCandle(validSymbol, timeframe)
      if (cc) {
        liveCandleRef.current = {
          time: cc.time,
          open: cc.open,
          close: price,
          high: Math.max(cc.high, price),
          low: Math.min(cc.low, price),
        }
      }

      const p = performance.now()
      if (p - lastUiRef.current > 100) {
        lastUiRef.current = p
        setTick((t) => t + 1)
      }
      lastFrame = nowMs
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)

    // Watchdog: garante que a interpolacao SEMPRE avance mesmo se o rAF for estrangulado
    // (preview em iframe, aba em segundo plano, alguns navegadores mobile).
    const watchdog = setInterval(() => {
      if (mountedRef.current && Date.now() - lastFrame > 250) step()
    }, 250)

    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden && mountedRef.current) {
        if (raf) cancelAnimationFrame(raf)
        raf = requestAnimationFrame(step)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    return () => {
      mountedRef.current = false
      if (raf) cancelAnimationFrame(raf)
      clearInterval(watchdog)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [validSymbol, timeframe, asset.decimals])

  // Monta o array de velas com a vela viva no final.
  const allCandles = [...candlesRef.current]
  const live = liveCandleRef.current
  if (live && live.time > 0) {
    const idx = allCandles.findIndex((c) => c.time === live.time)
    if (idx >= 0) allCandles[idx] = live
    else allCandles.push(live)
  }

  return {
    symbol: validSymbol,
    name: asset.name,
    // Nunca 0: se a suavizacao ainda nao rodou, usa o preco deterministico direto.
    price: smoothRef.current || multiAssetEngine.getCurrentPrice(validSymbol),
    candles: allCandles,
    currentCandle: live,
    timestamp: Math.floor(Date.now() / 1000),
    isConnected: true,
    // true quando o simbolo usa feed real E o preco real ja chegou (usado para recarregar o
    // grafico com o historico real assim que ele fica disponivel).
    realReady: isRealSymbol(validSymbol) && hasRealPrice(validSymbol),
    error: null as string | null,
  }
}
