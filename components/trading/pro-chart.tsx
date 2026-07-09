"use client"

import React, { useEffect, useRef, useState } from "react"

// ========== ERROR BOUNDARY ==========
class ChartErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#131722" }}>
          <span className="text-[#787B86] text-xs">Erro ao carregar grafico</span>
        </div>
      )
    }
    return this.props.children
  }
}

// ========== TYPES ==========
interface Candle { time: number; open: number; high: number; low: number; close: number }
interface ActiveTrade { id: string; entryPrice: number; direction: "call" | "put"; expiryTime: number; timestamp: number; amount?: number }
interface Props { candles: Candle[]; currentPrice: number; activeTrades?: ActiveTrade[]; timeframe: number; symbol: string }

// ========== HELPERS ==========
function calcEma(closes: number[], period: number): number[] {
  const r: number[] = []
  if (!closes.length) return r
  const k = 2 / (period + 1)
  let v = 0
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { r.push(0); continue }
    if (i === period - 1) { let s = 0; for (let j = i - period + 1; j <= i; j++) s += closes[j]; v = s / period; r.push(v); continue }
    v = closes[i] * k + v * (1 - k); r.push(v)
  }
  return r
}

function dedup(arr: Candle[]): Candle[] {
  const m = new Map<number, Candle>()
  arr.forEach(c => { if (c.time > 0 && c.open > 0) m.set(c.time, c) })
  return Array.from(m.values()).sort((a, b) => a.time - b.time)
}

function fmtPrice(p: number, sym: string): string {
  if (!p || p <= 0) return "0.00000"
  if (sym.includes("JPY")) return p.toFixed(3)
  if (sym.includes("BTC") || sym.includes("ETH") || sym.includes("BNB") || sym.includes("GOLD") || sym.includes("OIL") || sym.includes("SILVER")) return p.toFixed(2)
  return p.toFixed(5)
}

// ========== PRELOAD lightweight-charts at module level ==========
let _lwcLib: Promise<any> | null = null
function getLwc() {
  if (!_lwcLib || _lwcLib.then) {
    _lwcLib = import("lightweight-charts").catch((err) => {
      console.error("[v0] Failed to load lightweight-charts:", err)
      _lwcLib = null // Reset cache on error
      throw err
    })
  }
  return _lwcLib
}
if (typeof window !== "undefined") {
  // Preload in background but don't block
  getLwc().catch(() => {
    // Ignore preload errors, they'll be caught later
  })
}

// ========== INSTANT SEED CANDLES (shows chart in <10ms) ==========
function generateSeedCandles(symbol: string, timeframe: number, count: number): Candle[] {
  const bases: Record<string, number> = {
    "EURUSD_OTC": 1.08550, "GBPUSD_OTC": 1.27200, "USDJPY_OTC": 149.500,
    "AUDUSD_OTC": 0.65300, "USDCAD_OTC": 1.36100, "EURGBP_OTC": 0.85400,
    "EURJPY_OTC": 162.200, "GBPJPY_OTC": 190.100, "BTCUSD_OTC": 95800,
    "ETHUSD_OTC": 3200, "GOLD_OTC": 2650, "SILVER_OTC": 31.50,
  }
  const bp = bases[symbol] || 1.08550
  const isJpy = symbol.includes("JPY")
  const isCrypto = symbol.includes("BTC") || symbol.includes("ETH")
  const vol = isCrypto ? bp * 0.0008 : isJpy ? bp * 0.0003 : bp * 0.0003
  const prec = isJpy ? 3 : isCrypto ? 2 : 5

  const now = Math.floor(Date.now() / 1000)
  const slot = Math.floor(now / timeframe) * timeframe
  const candles: Candle[] = []
  let price = bp

  for (let i = count; i > 0; i--) {
    const time = slot - i * timeframe
    const open = price
    const seed = time * 9876.54 + bp * 13.37
    const r1 = Math.sin(seed) * 43758.5453 % 1
    const r2 = Math.sin(seed * 2.1) * 43758.5453 % 1
    const r3 = Math.sin(seed * 3.7) * 43758.5453 % 1
    const delta = (r1 - 0.5) * vol * 2
    const close = open + delta
    const high = Math.max(open, close) + Math.abs(delta) * (0.2 + Math.abs(r2) * 0.8)
    const low = Math.min(open, close) - Math.abs(delta) * (0.2 + Math.abs(r3) * 0.8)
    price = close
    candles.push({
      time,
      open: Number(open.toFixed(prec)),
      high: Number(high.toFixed(prec)),
      low: Number(low.toFixed(prec)),
      close: Number(close.toFixed(prec)),
    })
  }
  return candles
}

// ========== CHART CORE ==========
function ChartCore({ candles, currentPrice, activeTrades = [], timeframe, symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ohlcRef = useRef<HTMLDivElement>(null)
  const priceTagRef = useRef<HTMLDivElement>(null)
  const [cds, setCds] = useState<Record<string, number>>({})

  // Shared refs for trade lines
  const seriesRef = useRef<any>(null)
  const lwcRef = useRef<any>(null)
  const tradeLinesRef = useRef<any[]>([])

  // Always-fresh props
  const latest = useRef({ candles, currentPrice, timeframe, symbol })
  latest.current = { candles, currentPrice, timeframe, symbol }

  // Smooth price interpolation refs
  const smoothPriceRef = useRef(0)
  const prevTargetRef = useRef(0)
  const lastTickRef = useRef(0)
  const animFrameRef = useRef(0)

  // ========== COUNTDOWN ==========
  useEffect(() => {
    if (!activeTrades.length) { setCds({}); return }
    const tick = () => {
      const now = Date.now()
      const r: Record<string, number> = {}
      activeTrades.forEach(t => {
        r[t.id] = Math.max(0, Math.ceil((t.timestamp + t.expiryTime * 1000 - now) / 1000))
      })
      setCds(r)
    }
    tick()
    const iv = setInterval(tick, 250)
    return () => clearInterval(iv)
  }, [activeTrades])

  // ========== MAIN CHART EFFECT ==========
  useEffect(() => {
    let dead = false

    const state = {
      chart: null as any,
      series: null as any,
      ema9: null as any,
      ema21: null as any,
      ro: null as ResizeObserver | null,
      updateIv: null as ReturnType<typeof setInterval> | null,
      retryIv: null as ReturnType<typeof setInterval> | null,
      candle: null as Candle | null,
      displayedPrice: 0,
      lastDomUpdate: 0,
      ema9Val: 0,
      ema21Val: 0,
      dir: "",
      realDataLoaded: false,
    }

    // ---- DOM helpers (zero React, direct DOM) ----
    function updateOhlc(o: number, h: number, l: number, c: number) {
      if (!ohlcRef.current) return
      const s = latest.current.symbol
      const fp = (p: number) => fmtPrice(p, s)
      const pct = o > 0 ? ((c - o) / o) * 100 : 0
      const sym = s.replace("_OTC", "").replace("-OTC", "")
      const clr = pct >= 0 ? "#00FF88" : "#FF3B3B"
      ohlcRef.current.innerHTML =
        `<span style="color:#E2E8F0;font-weight:600;font-size:12px">${sym}</span>` +
        `<span style="color:#334155;margin:0 4px">|</span>` +
        `<span style="color:#94A3B8;font-size:10px">O <span style="color:#E2E8F0">${fp(o)}</span></span>` +
        `<span style="color:#94A3B8;font-size:10px;margin-left:6px">H <span style="color:#00FF88">${fp(h)}</span></span>` +
        `<span style="color:#94A3B8;font-size:10px;margin-left:6px">L <span style="color:#FF3B3B">${fp(l)}</span></span>` +
        `<span style="color:#94A3B8;font-size:10px;margin-left:6px">C <span style="color:${clr}">${fp(c)}</span></span>` +
        `<span style="color:${clr};font-size:10px;font-weight:700;margin-left:6px;padding:1px 4px;border-radius:3px;background:${clr}1a">${pct >= 0 ? "+" : ""}${pct.toFixed(3)}%</span>` +
        `<span style="color:#94A3B8;font-size:10px;margin-left:8px">EMA9 <span style="color:#F7931A">${fp(state.ema9Val)}</span></span>` +
        `<span style="color:#94A3B8;font-size:10px;margin-left:6px">EMA21 <span style="color:#2962FF">${fp(state.ema21Val)}</span></span>`
    }

    function updateTag(price: number) {
      if (!priceTagRef.current || price <= 0) return
      // Vollax style - verde brilhante e vermelho
      const bg = state.dir === "up" ? "#00E676" : state.dir === "down" ? "#FF5252" : "#2A2E39"
      const tc = state.dir === "up" ? "#000000" : "#FFFFFF"
      const arrow = state.dir === "up" ? "\u25B2 " : state.dir === "down" ? "\u25BC " : ""
      priceTagRef.current.style.background = bg
      priceTagRef.current.style.color = tc
      priceTagRef.current.textContent = `${arrow}${fmtPrice(price, latest.current.symbol)}`
    }

    // ---- Apply candle data to chart (seed or real) ----
    function applyData(data: Candle[]) {
      if (dead || !state.series || data.length === 0) return
      const last = data[data.length - 1]

      try {
        state.series.setData(data.map(c => ({
          time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
        })))
      } catch { return }

      const closes = data.map(c => c.close)
      const e9 = calcEma(closes, 9)
      const e21 = calcEma(closes, 21)
      try {
        state.ema9?.setData(data.map((c, i) => e9[i] > 0 ? { time: c.time as any, value: e9[i] } : null).filter(Boolean))
        state.ema21?.setData(data.map((c, i) => e21[i] > 0 ? { time: c.time as any, value: e21[i] } : null).filter(Boolean))
      } catch {}
      state.ema9Val = e9[e9.length - 1] || 0
      state.ema21Val = e21[e21.length - 1] || 0

      state.candle = { ...last }
      state.displayedPrice = last.close

      // Balanced zoom - show more candles on PC
      const isMobile = (containerRef.current?.clientWidth || 0) < 768
      const visible = isMobile ? 15 : 35 // More candles visible on PC
      const fromIdx = Math.max(0, data.length - visible)
      try {
        state.chart?.timeScale().setVisibleRange({
          from: data[fromIdx].time as any,
          to: data[data.length - 1].time as any,
        })
      } catch {}
      try { state.chart?.timeScale().scrollToRealTime() } catch {}

      updateOhlc(last.open, last.high, last.low, last.close)
      updateTag(last.close)
    }

    // ---- Try load real API data (replaces seed) ----
    function tryLoadRealData(): boolean {
      if (dead || !state.series || state.realDataLoaded) return state.realDataLoaded
      const raw = latest.current.candles
      const data = dedup((raw || []).filter(c => c && c.time > 0 && c.open > 0 && c.close > 0 && c.high > 0 && c.low > 0))
      if (data.length === 0) return false
      applyData(data)
      state.realDataLoaded = true
      return true
    }

    // ---- 60fps Smooth Tick (IQ Option style) ----
    function tick() {
      if (dead || !state.series || !state.candle) return
      const target = latest.current.currentPrice
      if (target <= 0) return

      const now = performance.now()
      const dt = Math.min(50, now - (lastTickRef.current || now)) // cap delta to 50ms
      lastTickRef.current = now

      // Initialize smooth price
      if (smoothPriceRef.current === 0) {
        smoothPriceRef.current = target
        prevTargetRef.current = target
      }

      const sym = latest.current.symbol
      const pip = sym.includes("JPY") ? 0.01 : (sym.includes("BTC") || sym.includes("ETH")) ? 1 : 0.0001
      const gap = Math.abs(target - smoothPriceRef.current)

      // IQ Option style - movimento muito mais suave e lento
      const alpha = gap > pip * 100 ? 0.8 : // Snap only for big jumps (symbol change)
                    gap > pip * 20 ? 0.15 :  // Gradual catch-up
                    gap > pip * 5 ? 0.08 :   // Slow movement
                    0.04 // Very smooth normal movement

      smoothPriceRef.current += (target - smoothPriceRef.current) * alpha

      // Use smoothed price directly
      const displayPrice = smoothPriceRef.current

      // Direction detection
      if (Math.abs(target - prevTargetRef.current) > pip * 0.5) {
        state.dir = target > prevTargetRef.current ? "up" : "down"
        prevTargetRef.current = target
      }

      // New candle period?
      const nowSec = Math.floor(Date.now() / 1000)
      const tf = latest.current.timeframe
      const newTime = Math.floor(nowSec / tf) * tf
      if (newTime > state.candle.time) {
        state.candle = {
          time: newTime,
          open: displayPrice,
          high: displayPrice,
          low: displayPrice,
          close: displayPrice,
        }
      }

      // Update candle with current price
      state.candle.close = displayPrice
      state.candle.high = Math.max(state.candle.high, displayPrice)
      state.candle.low = Math.min(state.candle.low, displayPrice)

      try {
        state.series.update({
          time: state.candle.time as any,
          open: state.candle.open,
          high: state.candle.high,
          low: state.candle.low,
          close: state.candle.close,
        })
      } catch {}

      // Throttle DOM updates to ~15fps (every ~66ms) for smooth visuals
      if (!state.lastDomUpdate || now - state.lastDomUpdate > 66) {
        state.lastDomUpdate = now
        updateOhlc(state.candle.open, state.candle.high, state.candle.low, state.candle.close)
        updateTag(displayPrice)
      }
    }

    // ---- BOOT ----
    async function boot() {
      if (!containerRef.current || dead) return
      if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
        if (!dead) setTimeout(boot, 30)
        return
      }

      try {
        const lwc = await getLwc()
        if (dead || !containerRef.current) return
        if (!lwc || !lwc.createChart) {
          console.error("[v0] lightweight-charts not available")
          _lwcLib = null
          return
        }

        const CT = lwc.ColorType || { Solid: "solid" }
        const CM = lwc.CrosshairMode || { Normal: 0 }
        const LS = lwc.LineStyle || { Dashed: 1 }
        const isMobile = containerRef.current.clientWidth < 768

        const chart = lwc.createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
          layout: {
            background: { type: CT.Solid, color: "#131722" },
            textColor: "#787B86",
            fontSize: 11,
            fontFamily: "'SF Mono',Consolas,monospace",
          },
          grid: { 
            vertLines: { color: "rgba(42, 46, 57, 0.5)", style: 1 }, 
            horzLines: { color: "rgba(42, 46, 57, 0.5)", style: 1 } 
          },
          crosshair: {
            mode: CM.Normal,
            vertLine: { color: "rgba(255,255,255,0.4)", width: 1, style: LS.Dashed, labelBackgroundColor: "#2A2E39" },
            horzLine: { color: "rgba(255,255,255,0.4)", width: 1, style: LS.Dashed, labelBackgroundColor: "#2A2E39" },
          },
          rightPriceScale: { borderColor: "#363A45", autoScale: true, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: {
            borderColor: "#363A45", timeVisible: true, secondsVisible: timeframe <= 60,
            barSpacing: isMobile ? 22 : 30, minBarSpacing: 10, rightOffset: 15,
          },
          handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
          handleScale: { mouseWheel: true, pinch: true, axisDoubleClickReset: { time: true, price: true }, axisPressedMouseMove: { time: true, price: true } },
          kineticScroll: { touch: true, mouse: true },
        })

        if (dead) { try { chart.remove() } catch {}; return }

        // Vollax/IQ Option style - verde brilhante e vermelho intenso
        const cOpts = {
          upColor: "#00E676", downColor: "#FF5252",
          borderUpColor: "#00E676", borderDownColor: "#FF5252",
          wickUpColor: "#00E676", wickDownColor: "#FF5252",
          priceLineVisible: true, priceLineColor: "#00E676",
          priceLineWidth: 1 as const, lastValueVisible: true,
        }
        const eOpts = (color: string) => ({
          color, lineWidth: 2 as const,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        })

        let cs: any, e9s: any, e21s: any
        try {
          if (lwc.CandlestickSeries) {
            cs = chart.addSeries(lwc.CandlestickSeries, cOpts)
            e9s = chart.addSeries(lwc.LineSeries, eOpts("#F7931A"))
            e21s = chart.addSeries(lwc.LineSeries, eOpts("#2962FF"))
          } else throw 0
        } catch {
          try {
            cs = (chart as any).addCandlestickSeries(cOpts)
            e9s = (chart as any).addLineSeries(eOpts("#F7931A"))
            e21s = (chart as any).addLineSeries(eOpts("#2962FF"))
          } catch { try { chart.remove() } catch {}; return }
        }
        if (!cs || dead) { try { chart.remove() } catch {}; return }

        state.chart = chart
        state.series = cs
        state.ema9 = e9s
        state.ema21 = e21s
        seriesRef.current = cs
        lwcRef.current = lwc

        chart.subscribeCrosshairMove((p: any) => {
          if (!p?.seriesData) return
          const d = p.seriesData.get(cs)
          if (d && "open" in d) updateOhlc(d.open, d.high, d.low, d.close)
        })

        state.ro = new ResizeObserver((entries) => {
          for (const e of entries) {
            const { width, height } = e.contentRect
            if (width > 0 && height > 0 && state.chart) {
              try { state.chart.applyOptions({ width, height }) } catch {}
            }
          }
        })
        if (containerRef.current) state.ro.observe(containerRef.current)

        // ================================================
        // INSTANT DISPLAY: seed candles -> show immediately
        // ================================================
        const seedData = generateSeedCandles(symbol, timeframe, 30)
        applyData(seedData)
        // loaded already true by default

        // Start 60fps animation loop (IQ Option style smooth updates)
        const animLoop = () => {
          if (dead) return
          tick()
          animFrameRef.current = requestAnimationFrame(animLoop)
        }
        animFrameRef.current = requestAnimationFrame(animLoop)

        // Background: replace seed with real API data when available
        state.retryIv = setInterval(() => {
          if (dead) { clearInterval(state.retryIv!); state.retryIv = null; return }
          if (tryLoadRealData()) {
            clearInterval(state.retryIv!); state.retryIv = null
          }
        }, 200)

      } catch {}
    }

    boot()

    // ========== CLEANUP ==========
    return () => {
      dead = true
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (state.retryIv) clearInterval(state.retryIv)
      if (state.ro) state.ro.disconnect()
      if (state.chart) { try { state.chart.remove() } catch {} }
      seriesRef.current = null
      lwcRef.current = null
      tradeLinesRef.current = []
      smoothPriceRef.current = 0
      prevTargetRef.current = 0
      lastTickRef.current = 0
      // Don't setLoaded(false) - keep chart visible during transitions
    }
  }, [timeframe, symbol]) // Recreate on timeframe OR symbol change

  // ========== TRADE LINES (IQ Option style) ==========
  useEffect(() => {
    const series = seriesRef.current
    const lwc = lwcRef.current
    if (!series) return

    // Remove all existing trade lines
    tradeLinesRef.current.forEach(l => { try { series.removePriceLine(l) } catch {} })
    tradeLinesRef.current = []

    const LS = lwc?.LineStyle
    activeTrades.forEach(trade => {
      if (trade.entryPrice <= 0) return
      const cd = cds[trade.id] ?? -1
      // Skip trades with expired countdown - line should disappear
      if (cd <= 0) return
      const isCall = trade.direction === "call"
      // Vollax style colors
      const color = isCall ? "#00E676" : "#FF5252"
      const label = isCall ? "▲ CALL" : "▼ PUT"
      const m = Math.floor(cd / 60), s = cd % 60
      const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      const amount = trade.amount ? ` R$${trade.amount.toFixed(0)}` : ""
      const isUrgent = cd <= 10
      
      try {
        const line = series.createPriceLine({
          price: trade.entryPrice, 
          color: isUrgent ? "#FFEB3B" : color, 
          lineWidth: 2,
          lineStyle: LS?.Dashed || 1, 
          axisLabelVisible: true,
          title: ` ${label} ${timeStr}${amount} `,
        })
        if (line) tradeLinesRef.current.push(line)
      } catch {}
    })

    return () => {
      // Cleanup on unmount
      tradeLinesRef.current.forEach(l => { try { series.removePriceLine(l) } catch {} })
      tradeLinesRef.current = []
    }
  }, [activeTrades, cds])

  // ========== RENDER ==========
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: "#131722" }}>
      <div
        ref={ohlcRef}
        className="absolute top-2 left-2 z-20 flex flex-wrap items-center gap-x-1 px-2 py-1 rounded-lg"
        style={{ backgroundColor: "rgba(15,23,42,0.92)", fontFamily: "'SF Mono',Consolas,monospace" }}
      />
      <div
        ref={priceTagRef}
        className="absolute right-1 z-20 px-2 py-0.5 rounded-sm font-mono font-bold text-white"
        style={{ top: "50%", fontSize: 11, background: "#2A2E39" }}
      />
      <div ref={containerRef} className="absolute inset-0" style={{ zIndex: 2 }} />
    </div>
  )
}

// ========== EXPORT ==========
export function ProChart(props: Props) {
  return (
    <ChartErrorBoundary>
      <ChartCore {...props} />
    </ChartErrorBoundary>
  )
}

export default ProChart
