"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import type { OTCCandle } from "@/lib/price-engine/multi-asset-engine"

interface GlobalOTCState {
  symbol: string
  name: string
  price: number
  timestamp: number
  candles: OTCCandle[]
  currentCandle: OTCCandle | null
  timeframe: 60 | 300 | 600
}

export function useGlobalOTC(symbol: string, timeframe: 60 | 300 | 600) {
  const [state, setState] = useState<GlobalOTCState | null>(null)
  const [isConnected, setIsConnected] = useState(true) // Start as connected - TradingView handles its own connection
  const [error, setError] = useState<string | null>(null)
  // Single tick counter to trigger re-renders at controlled rate
  const [tick, setTick] = useState(0)

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const rafRef = useRef<number>(0)
  const mountedRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const fetchingRef = useRef(false)
  // Momento em que a requisicao atual comecou — usado para detectar/abortar requisicoes travadas.
  const fetchStartRef = useRef(0)

  // All interpolation lives in refs - NO setState in rAF
  const prevPriceRef = useRef(0)
  const targetPriceRef = useRef(0)
  const currentPriceRef = useRef(0)
  const transitionStartRef = useRef(0)
  const noiseSeedRef = useRef(0)
  const pipSizeRef = useRef(0.00001)
  const lastUiRef = useRef(0)
  const stateRef = useRef<GlobalOTCState | null>(null)
  const liveCandleRef = useRef<OTCCandle | null>(null)

  const fetchState = useCallback(async () => {
    if (!mountedRef.current || fetchingRef.current) return
    fetchingRef.current = true
    fetchStartRef.current = Date.now()

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Timeout de seguranca: se a requisicao travar (comum em preview/iframe ou rede instavel),
    // aborta em 4s para que o finally rode, libere o fetchingRef e o polling volte a funcionar.
    // Sem isso, uma unica requisicao travada congela o preco ate um F5.
    const timeoutId = setTimeout(() => {
      try { controller.abort() } catch {}
    }, 4000)

    try {
      const res = await fetch(
        `/api/global/state?symbol=${symbol}&timeframe=${timeframe}&_t=${Date.now()}`,
        { cache: "no-store", signal: controller.signal }
      )
      if (controller.signal.aborted || !mountedRef.current) return
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      if (!mountedRef.current || controller.signal.aborted || !data) return

      stateRef.current = data
      setState(data)
      setIsConnected(true)
      setError(null)

      const newPrice = data.price
      const cur = currentPriceRef.current
      // Salto enorme (>3x) = troca de ativo (escalas muito diferentes, ex.: EUR ~1.08 -> SHIB ~0.0000245).
      // Nesses casos fazemos "snap" instantaneo, sem interpolar — interpolar geraria precos
      // intermediarios falsos (0.71, 0.89...) e uma vela gigante no grafico.
      const hugeJump = cur > 0 && (newPrice / cur > 3 || cur / newPrice > 3)
      if (cur === 0 || hugeJump || newPrice <= 0) {
        currentPriceRef.current = newPrice
        prevPriceRef.current = newPrice
        targetPriceRef.current = newPrice
        transitionStartRef.current = 0
        liveCandleRef.current = null
      } else {
        prevPriceRef.current = cur
        targetPriceRef.current = newPrice
        transitionStartRef.current = performance.now()
      }

      // Ruido (micro-movimento) proporcional a escala do preco — funciona para qualquer ativo
      // (forex, acoes, cripto e memecoins) sem depender do simbolo.
      pipSizeRef.current = Math.max(newPrice * 0.00005, 1e-12)

      noiseSeedRef.current = Date.now()
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      if (err instanceof DOMException && err.name === "AbortError") return
      // Don't set disconnected - TradingView chart handles its own connection
      // Just log error silently and keep trying
      console.log("[v0] OTC fetch error, retrying...")
    } finally {
      clearTimeout(timeoutId)
      fetchingRef.current = false
    }
  }, [symbol, timeframe])

  // 60fps animation loop - updates refs only, throttles React re-renders
  useEffect(() => {
    mountedRef.current = true
    let lastFrameAt = 0

    // Um unico "passo" de interpolacao. Isolado para poder ser chamado tanto pelo
    // requestAnimationFrame (suave, 60fps) quanto por um setInterval de seguranca.
    const stepFrame = () => {
      if (!mountedRef.current) return

      const prev = prevPriceRef.current
      const target = targetPriceRef.current

      if (target > 0 && prev > 0) {
        const now = performance.now()
        const elapsed = now - transitionStartRef.current
        const raw = Math.min(1, elapsed / 300)
        const t = raw * raw * (3 - 2 * raw) // smoothstep easing

        let interpolated = prev + (target - prev) * t

        // Micro-noise for live feel
        const nPhase = now * 0.007 + noiseSeedRef.current
        interpolated += Math.sin(nPhase) * pipSizeRef.current * 0.3
        interpolated += Math.sin(nPhase * 2.7 + 1.3) * pipSizeRef.current * 0.15

        currentPriceRef.current = interpolated

        // Update live candle ref
        const s = stateRef.current
        if (s?.currentCandle && interpolated > 0) {
          const base = s.currentCandle
          liveCandleRef.current = {
            time: base.time,
            open: base.open,
            close: interpolated,
            high: Math.max(base.high, interpolated),
            low: Math.min(base.low, interpolated),
          }
        }

        // Throttled React re-render: max ~8fps for UI (every 120ms)
        if (now - lastUiRef.current > 120) {
          lastUiRef.current = now
          setTick(t => t + 1)
        }
      }
      lastFrameAt = Date.now()
    }

    const animate = () => {
      if (!mountedRef.current) return
      stepFrame()
      rafRef.current = requestAnimationFrame(animate)
    }

    lastFrameAt = Date.now()
    rafRef.current = requestAnimationFrame(animate)

    // Rede de seguranca: em ambientes que estrangulam o requestAnimationFrame
    // (preview em iframe, abas em segundo plano, alguns navegadores mobile), o preco
    // ao vivo — e portanto o grafico inteiro — congela. Este intervalo garante que a
    // interpolacao SEMPRE avance, mesmo sem rAF, entao o grafico nunca fica travado.
    const watchdog = setInterval(() => {
      if (!mountedRef.current) return
      if (Date.now() - lastFrameAt > 200) stepFrame()
    }, 200)

    // Retoma imediatamente ao voltar o foco / aba visivel.
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden && mountedRef.current) {
        stepFrame()
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    return () => {
      mountedRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      clearInterval(watchdog)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [])

  // Reset do estado de preco sempre que o ativo muda. Sem isso, os refs de preco do ativo
  // anterior "vazam" para o novo (ex.: EUR/USD 1.08 -> Ondo 1.18, que sao escalas parecidas e
  // nao disparam o snap por hugeJump), causando preco errado no cabecalho e uma vela gigante.
  // Zerar os refs garante que o primeiro fetch do novo ativo faca snap instantaneo.
  useEffect(() => {
    currentPriceRef.current = 0
    prevPriceRef.current = 0
    targetPriceRef.current = 0
    transitionStartRef.current = 0
    liveCandleRef.current = null
    stateRef.current = null
    setState(null)
  }, [symbol])

  // Fast initial fetch + adaptive polling
  useEffect(() => {
    mountedRef.current = true
    fetchingRef.current = false
    let initialLoaded = false

    // Immediate first fetch
    const doFetch = async () => {
      await fetchState()
      if (!initialLoaded && stateRef.current && mountedRef.current) {
        initialLoaded = true
      }
    }
    doFetch()

    // Polling: 300ms for smoother price updates
    pollRef.current = setInterval(() => {
      if (!mountedRef.current) return
      if (fetchingRef.current) {
        // Se a requisicao atual esta travada ha mais de 2s, aborta para destravar o polling
        // (o finally libera o fetchingRef e a proxima tentativa segue normalmente).
        if (Date.now() - fetchStartRef.current > 2000 && abortRef.current) {
          try { abortRef.current.abort() } catch {}
        }
        return
      }
      fetchState()
    }, 300)

    return () => {
      mountedRef.current = false
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      if (abortRef.current) { try { abortRef.current.abort() } catch {}; abortRef.current = null }
    }
  }, [fetchState])

  // Build candles array from refs (computed on each throttled tick)
  const historicalCandles = state?.candles || []
  const allCandles = [...historicalCandles]
  const liveCandle = liveCandleRef.current || state?.currentCandle || null

  if (liveCandle && liveCandle.time > 0) {
    const idx = allCandles.findIndex(c => c.time === liveCandle.time)
    if (idx >= 0) allCandles[idx] = liveCandle
    else allCandles.push(liveCandle)
  }

  // Force use of tick to avoid tree-shaking
  void tick

  return {
    symbol: state?.symbol || symbol,
    name: state?.name || symbol,
    price: currentPriceRef.current || state?.price || 0,
    candles: allCandles,
    currentCandle: liveCandle,
    timestamp: state?.timestamp || 0,
    isConnected,
    error,
  }
}
