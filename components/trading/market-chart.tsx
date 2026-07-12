"use client"

import React, { useEffect, useRef, useState } from "react"
import { OTC_ASSETS, multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"

// Mapa central de casas decimais por simbolo (fonte unica: engine de precos)
const SYMBOL_DECIMALS: Record<string, number> = Object.fromEntries(
  OTC_ASSETS.map((a) => [a.symbol, a.decimals]),
)

// Retorna as casas decimais corretas para um simbolo.
// Fallback inteligente por magnitude do preco para simbolos desconhecidos.
function getDecimals(sym: string, price?: number): number {
  if (SYMBOL_DECIMALS[sym] != null) return SYMBOL_DECIMALS[sym]
  if (price != null && price > 0) {
    if (price < 0.001) return 8
    if (price < 1) return 5
    if (price < 1000) return price < 10 ? 4 : 2
    return 2
  }
  if (sym.includes("JPY")) return 3
  return 5
}

// ========== ERROR BOUNDARY ==========
class ChartErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#0d0d0f" }}>
          <span className="text-[#787B86] text-xs">Erro ao carregar grafico</span>
        </div>
      )
    }
    return this.props.children
  }
}

// ========== TYPES ==========
interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}
interface ActiveTrade {
  id: string
  entryPrice: number
  direction: "call" | "put"
  expiryTime: number
  timestamp: number
  amount?: number
}
interface TradeResult {
  type: "win" | "loss"
  amount: number
}
interface Props {
  candles: Candle[]
  currentPrice: number
  activeTrades?: ActiveTrade[]
  timeframe: 60 | 300 | 600
  symbol: string
  payout?: number
  result?: TradeResult | null
}
interface PnlOverlay {
  id: string
  top: number
  pnl: number
  inMoney: boolean
  isCall: boolean
  time: string
}

// ========== DRAWING TOOLS (estilo IQ Option) ==========
type DrawTool = "cursor" | "trend" | "horizontal" | "ray" | "vertical" | "rect" | "fib" | "eraser"
type DrawShape = Exclude<DrawTool, "cursor" | "eraser">
// Ancora um ponto do desenho no espaco do grafico (indice logico no eixo X, preco no eixo Y)
// para que a marcacao acompanhe o scroll/zoom do grafico.
interface DrawAnchor {
  logical: number
  price: number
}
interface Drawing {
  id: string
  type: DrawShape
  a: DrawAnchor
  b?: DrawAnchor
  color: string
}

const DRAW_COLORS = ["#a855f7", "#00E676", "#FF5252", "#FFC400", "#38bdf8", "#e2e8f0"]
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]

const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}
const DRAW_TOOLS: { id: DrawTool; label: string; icon: React.ReactNode }[] = [
  {
    id: "cursor",
    label: "Cursor (mover grafico)",
    icon: (
      <svg {...svgProps}>
        <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="m13 13 6 6" />
      </svg>
    ),
  },
  {
    id: "trend",
    label: "Linha de tendencia",
    icon: (
      <svg {...svgProps}>
        <line x1="4" y1="20" x2="20" y2="4" />
      </svg>
    ),
  },
  {
    id: "horizontal",
    label: "Linha horizontal (marcar topo/fundo)",
    icon: (
      <svg {...svgProps}>
        <line x1="3" y1="12" x2="21" y2="12" />
        <circle cx="7" cy="12" r="1.5" fill="currentColor" />
        <circle cx="17" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "ray",
    label: "Raio (linha estendida)",
    icon: (
      <svg {...svgProps}>
        <line x1="4" y1="18" x2="20" y2="6" />
        <path d="M14 6h6v6" />
      </svg>
    ),
  },
  {
    id: "vertical",
    label: "Linha vertical",
    icon: (
      <svg {...svgProps}>
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: "rect",
    label: "Retangulo / zona",
    icon: (
      <svg {...svgProps}>
        <rect x="4" y="6" width="16" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: "fib",
    label: "Retracao de Fibonacci",
    icon: (
      <svg {...svgProps}>
        <line x1="3" y1="5" x2="21" y2="5" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="3" y1="14" x2="21" y2="14" />
        <line x1="3" y1="19" x2="21" y2="19" />
      </svg>
    ),
  },
  {
    id: "eraser",
    label: "Apagar marcacao",
    icon: (
      <svg {...svgProps}>
        <path d="m7 21-4-4a2 2 0 0 1 0-3L14 3l7 7-11 11H7z" />
        <line x1="18" y1="12.5" x2="9.5" y2="4" />
      </svg>
    ),
  },
]

// ========== HELPERS ==========
function fmtPrice(p: number, sym: string): string {
  if (!p || p <= 0) return (0).toFixed(getDecimals(sym))
  return p.toFixed(getDecimals(sym, p))
}

function dedup(arr: Candle[]): Candle[] {
  const m = new Map<number, Candle>()
  arr.forEach((c) => {
    if (c && c.time > 0 && c.open > 0) m.set(c.time, c)
  })
  return Array.from(m.values()).sort((a, b) => a.time - b.time)
}

// Preload lightweight-charts at module level
let _lwcLib: Promise<any> | null = null
function getLwc() {
  if (!_lwcLib) {
    _lwcLib = import("lightweight-charts").catch((err) => {
      console.error("[v0] Failed to load lightweight-charts:", err)
      _lwcLib = null
      throw err
    })
  }
  return _lwcLib
}
if (typeof window !== "undefined") {
  getLwc().catch(() => {})
}

// ========== CHART CORE ==========
function ChartCore({ candles, currentPrice, activeTrades = [], timeframe, symbol, payout = 0.96, result }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  // Incrementa toda vez que uma NOVA serie do grafico e criada (ex.: ao trocar de moeda).
  // Serve para forcar o redesenho das linhas de operacao/overlays, que dependem de seriesRef
  // (uma ref que nao dispara re-render por si so).
  const [seriesReady, setSeriesReady] = useState(0)
  const [flash, setFlash] = useState<{ id: string; dir: "call" | "put" } | null>(null)
  const [pnlOverlays, setPnlOverlays] = useState<PnlOverlay[]>([])
  const [resultBurst, setResultBurst] = useState<{ type: "win" | "loss"; amount: number; key: number } | null>(null)
  const [clock, setClock] = useState("")

  // Relogio (horario de Brasilia, UTC-3) exibido minimizado no canto do grafico
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const utc = now.getTime() + now.getTimezoneOffset() * 60000
      const brt = new Date(utc - 3 * 60 * 60000)
      const hh = brt.getHours().toString().padStart(2, "0")
      const mm = brt.getMinutes().toString().padStart(2, "0")
      const ss = brt.getSeconds().toString().padStart(2, "0")
      setClock(`${hh}:${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Shared refs
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const lwcRef = useRef<any>(null)
  const tradeLinesRef = useRef<Map<string, any>>(new Map())
  const markersApiRef = useRef<any>(null)

  // Always-fresh props
  const latest = useRef({ candles, currentPrice, timeframe, symbol })
  latest.current = { candles, currentPrice, timeframe, symbol }

  // Smooth price interpolation
  const smoothPriceRef = useRef(0)
  const formingRef = useRef<Candle | null>(null)
  const dirRef = useRef<"up" | "down" | "">("")
  const prevTargetRef = useRef(0)
  const animFrameRef = useRef(0)
  // Simbolo cujos dados ja estao carregados na serie. Enquanto null (durante o carregamento),
  // o loop de render nao aplica preco — evita "vela gigante" ao trocar de ativo.
  const loadedSymbolRef = useRef<string | null>(null)
  // Funcao que reconfigura opcoes + recarrega os dados na MESMA serie (sem recriar o grafico).
  const loadDataRef = useRef<null | (() => void)>(null)

  // Countdown for trade lines
  const [cds, setCds] = useState<Record<string, number>>({})
  const prevTradeIdsRef = useRef<string[]>([])

  // ===== DRAWING TOOLS state/refs =====
  const [tool, setTool] = useState<DrawTool>("cursor")
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0])
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [showColors, setShowColors] = useState(false)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const draftRef = useRef<Drawing | null>(null)
  const drawingsRef = useRef<Drawing[]>([])
  const toolRef = useRef<DrawTool>("cursor")
  const drawColorRef = useRef<string>(DRAW_COLORS[0])
  drawingsRef.current = drawings
  toolRef.current = tool
  drawColorRef.current = drawColor

  // Guarda as marcacoes por moeda+timeframe para que nao se percam ao trocar de ativo.
  const drawingsStoreRef = useRef<Map<string, Drawing[]>>(new Map())
  const prevDrawKeyRef = useRef<string>(`${symbol}::${timeframe}`)

  // Ao trocar de ativo/timeframe: salva as marcacoes atuais e restaura as do novo contexto.
  useEffect(() => {
    const newKey = `${symbol}::${timeframe}`
    const prevKey = prevDrawKeyRef.current

    // Salva o que estava desenhado na moeda anterior
    drawingsStoreRef.current.set(prevKey, drawingsRef.current)

    // Restaura o que ja havia sido desenhado nesta moeda (ou vazio se nunca desenhou)
    const restored = drawingsStoreRef.current.get(newKey) ?? []
    setDrawings(restored)
    draftRef.current = null
    setTool("cursor")
    prevDrawKeyRef.current = newKey
  }, [symbol, timeframe])

  // Converte uma ancora (logical, price) -> coordenada de tela (px CSS)
  function anchorToXY(a: DrawAnchor): { x: number; y: number } | null {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return null
    try {
      const x = chart.timeScale().logicalToCoordinate(a.logical as any)
      const y = series.priceToCoordinate(a.price)
      if (x == null || y == null) return null
      return { x, y }
    } catch {
      return null
    }
  }

  // Converte coordenada de tela (px CSS) -> ancora (logical, price)
  function xyToAnchor(x: number, y: number): DrawAnchor | null {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return null
    try {
      const logical = chart.timeScale().coordinateToLogical(x)
      const price = series.coordinateToPrice(y)
      if (logical == null || price == null) return null
      return { logical: logical as number, price: price as number }
    } catch {
      return null
    }
  }

  // Distancia de um ponto a um segmento (para a borracha)
  function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(px - x1, py - y1)
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
  }

  // ===== Render loop das marcacoes (canvas overlay) =====
  useEffect(() => {
    let raf = 0
    let dead = false

    const render = () => {
      if (dead) return
      const canvas = drawCanvasRef.current
      const container = containerRef.current
      if (canvas && container) {
        const w = container.clientWidth
        const h = container.clientHeight
        const dpr = window.devicePixelRatio || 1
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr)
          canvas.height = Math.floor(h * dpr)
          canvas.style.width = `${w}px`
          canvas.style.height = `${h}px`
        }
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.clearRect(0, 0, w, h)
          const all = [...drawingsRef.current]
          if (draftRef.current) all.push(draftRef.current)
          all.forEach((d) => drawOne(ctx, d, w, h))
        }
      }
      raf = requestAnimationFrame(render)
    }

    const drawOne = (ctx: CanvasRenderingContext2D, d: Drawing, w: number, h: number) => {
      const pa = anchorToXY(d.a)
      if (!pa) return
      ctx.save()
      ctx.strokeStyle = d.color
      ctx.fillStyle = d.color
      ctx.lineWidth = 1.5
      ctx.font = "10px 'SF Mono',Consolas,monospace"
      const sym = latest.current.symbol

      if (d.type === "horizontal") {
        ctx.beginPath()
        ctx.moveTo(0, pa.y)
        ctx.lineTo(w, pa.y)
        ctx.stroke()
        const label = fmtPrice(d.a.price, sym)
        const tw = ctx.measureText(label).width + 8
        ctx.fillStyle = d.color
        ctx.fillRect(w - tw - 2, pa.y - 8, tw, 16)
        ctx.fillStyle = "#0d0d0f"
        ctx.fillText(label, w - tw + 2, pa.y + 3)
      } else if (d.type === "vertical") {
        ctx.beginPath()
        ctx.moveTo(pa.x, 0)
        ctx.lineTo(pa.x, h)
        ctx.stroke()
      } else if (d.type === "trend" || d.type === "ray") {
        const pb = d.b ? anchorToXY(d.b) : null
        if (!pb) {
          ctx.restore()
          return
        }
        let ex = pb.x
        let ey = pb.y
        if (d.type === "ray") {
          const dx = pb.x - pa.x
          const dy = pb.y - pa.y
          if (Math.abs(dx) < 1e-6) {
            // Raio praticamente vertical: estende ate a borda superior/inferior
            ex = pa.x
            ey = dy >= 0 ? h : 0
          } else {
            ex = dx >= 0 ? w : 0
            ey = pa.y + dy * ((ex - pa.x) / dx)
          }
        }
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(pa.x, pa.y, 3, 0, Math.PI * 2)
        ctx.fill()
        if (d.type === "trend") {
          ctx.beginPath()
          ctx.arc(pb.x, pb.y, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (d.type === "rect") {
        const pb = d.b ? anchorToXY(d.b) : null
        if (!pb) {
          ctx.restore()
          return
        }
        const x = Math.min(pa.x, pb.x)
        const y = Math.min(pa.y, pb.y)
        const rw = Math.abs(pb.x - pa.x)
        const rh = Math.abs(pb.y - pa.y)
        ctx.globalAlpha = 0.12
        ctx.fillRect(x, y, rw, rh)
        ctx.globalAlpha = 1
        ctx.strokeRect(x, y, rw, rh)
      } else if (d.type === "fib") {
        const pb = d.b ? anchorToXY(d.b) : null
        if (!pb) {
          ctx.restore()
          return
        }
        const x1 = Math.min(pa.x, pb.x)
        const x2 = Math.max(pa.x, pb.x)
        FIB_LEVELS.forEach((lvl) => {
          const price = d.a.price + (d.b!.price - d.a.price) * lvl
          const yc = seriesRef.current?.priceToCoordinate(price)
          if (yc == null) return
          ctx.globalAlpha = 0.9
          ctx.beginPath()
          ctx.moveTo(x1, yc)
          ctx.lineTo(x2, yc)
          ctx.stroke()
          ctx.globalAlpha = 1
          ctx.fillStyle = d.color
          ctx.fillText(`${(lvl * 100).toFixed(1)}%  ${fmtPrice(price, sym)}`, x1 + 4, yc - 3)
        })
      }
      ctx.restore()
    }

    raf = requestAnimationFrame(render)
    return () => {
      dead = true
      cancelAnimationFrame(raf)
    }
  }, [])

  // ===== Pointer handlers para desenhar =====
  function getPos(e: React.PointerEvent): { x: number; y: number } {
    const rect = drawCanvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleDrawPointerDown(e: React.PointerEvent) {
    const t = toolRef.current
    if (t === "cursor") return
    const pos = getPos(e)

    if (t === "eraser") {
      const list = drawingsRef.current
      let hitId: string | null = null
      let best = 10
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i]
        const pa = anchorToXY(d.a)
        if (!pa) continue
        let dist = Infinity
        if (d.type === "horizontal") dist = Math.abs(pos.y - pa.y)
        else if (d.type === "vertical") dist = Math.abs(pos.x - pa.x)
        else {
          const pb = d.b ? anchorToXY(d.b) : pa
          if (pb) dist = distToSegment(pos.x, pos.y, pa.x, pa.y, pb.x, pb.y)
        }
        if (dist < best) {
          best = dist
          hitId = d.id
        }
      }
      if (hitId) setDrawings((prev) => prev.filter((d) => d.id !== hitId))
      return
    }

    const anchor = xyToAnchor(pos.x, pos.y)
    if (!anchor) return
    const id = `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const color = drawColorRef.current

    if (t === "horizontal" || t === "vertical") {
      // Ferramentas de 1 clique: coloca imediatamente e mantem a ferramenta ativa
      // para permitir marcar varios topos/fundos em sequencia.
      setDrawings((prev) => [...prev, { id, type: t, a: anchor, color }])
      return
    }

    // Ferramentas de 2 pontos: inicia rascunho e captura o ponteiro
    draftRef.current = { id, type: t as DrawShape, a: anchor, b: anchor, color }
    try {
      drawCanvasRef.current?.setPointerCapture(e.pointerId)
    } catch {}
  }

  function handleDrawPointerMove(e: React.PointerEvent) {
    if (!draftRef.current) return
    const pos = getPos(e)
    const anchor = xyToAnchor(pos.x, pos.y)
    if (anchor) draftRef.current = { ...draftRef.current, b: anchor }
  }

  function handleDrawPointerUp(e: React.PointerEvent) {
    const draft = draftRef.current
    draftRef.current = null
    try {
      drawCanvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {}
    if (!draft || !draft.b) return
    const pa = anchorToXY(draft.a)
    const pb = anchorToXY(draft.b)
    // Descarta se muito pequeno (clique acidental)
    if (pa && pb && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 6) return
    setDrawings((prev) => [...prev, draft])
  }

  // ===== Detect new trades -> flash animation =====
  useEffect(() => {
    const ids = activeTrades.map((t) => t.id)
    const newOnes = activeTrades.filter((t) => !prevTradeIdsRef.current.includes(t.id))
    if (newOnes.length > 0) {
      const t = newOnes[newOnes.length - 1]
      setFlash({ id: t.id, dir: t.direction })
      const to = setTimeout(() => setFlash(null), 700)
      prevTradeIdsRef.current = ids
      return () => clearTimeout(to)
    }
    prevTradeIdsRef.current = ids
  }, [activeTrades])

  // ===== Countdown timer =====
  useEffect(() => {
    if (!activeTrades.length) {
      setCds({})
      return
    }
    const tick = () => {
      const now = Date.now()
      const r: Record<string, number> = {}
      activeTrades.forEach((t) => {
        r[t.id] = Math.max(0, Math.ceil((t.timestamp + t.expiryTime * 1000 - now) / 1000))
      })
      setCds(r)
    }
    tick()
    const iv = setInterval(tick, 250)
    return () => clearInterval(iv)
  }, [activeTrades])

  // ===== Update header (OHLC + price) =====
  function updateHeader(c: Candle, price: number) {
    if (!headerRef.current) return
    const s = latest.current.symbol
    const fp = (p: number) => fmtPrice(p, s)
    const pct = c.open > 0 ? ((price - c.open) / c.open) * 100 : 0
    const sym = s.replace("_OTC", "").replace("-OTC", "")
    const clr = pct >= 0 ? "#00E676" : "#FF5252"
    headerRef.current.innerHTML =
      `<span style="color:#E2E8F0;font-weight:700;font-size:13px">${sym}</span>` +
      `<span style="color:#334155;margin:0 6px">|</span>` +
      `<span style="color:#94A3B8;font-size:11px">O <span style="color:#E2E8F0">${fp(c.open)}</span></span>` +
      `<span style="color:#94A3B8;font-size:11px;margin-left:8px">H <span style="color:#00E676">${fp(c.high)}</span></span>` +
      `<span style="color:#94A3B8;font-size:11px;margin-left:8px">L <span style="color:#FF5252">${fp(c.low)}</span></span>` +
      `<span style="color:#94A3B8;font-size:11px;margin-left:8px">C <span style="color:${clr}">${fp(price)}</span></span>` +
      `<span style="color:${clr};font-size:11px;font-weight:700;margin-left:8px;padding:1px 5px;border-radius:4px;background:${clr}1a">${pct >= 0 ? "+" : ""}${pct.toFixed(3)}%</span>`
  }

  // ===== Contador regressivo do fechamento da vela (estilo IQ Option) =====
  // Mostra MM:SS que faltam para a vela atual fechar, alinhado verticalmente a linha do preco
  // atual (borda direita). Fica vermelho nos ultimos 10s para chamar a atencao.
  function updateCountdown(price: number) {
    const el = countdownRef.current
    if (!el) return
    const tf = latest.current.timeframe
    const nowMs = Date.now()
    const remaining = Math.max(0, Math.ceil((Math.ceil(nowMs / 1000 / tf) * tf - nowMs / 1000)))
    const mm = Math.floor(remaining / 60)
    const ss = remaining % 60
    el.textContent = `${mm}:${ss.toString().padStart(2, "0")}`

    // Posiciona verticalmente na altura do preco atual, se possivel.
    let y: number | null = null
    try {
      const c = seriesRef.current?.priceToCoordinate(price)
      if (typeof c === "number" && Number.isFinite(c)) y = c
    } catch {}
    if (y != null) {
      el.style.top = `${y}px`
      el.style.transform = "translateY(-50%)"
    }
    const urgent = remaining <= 10
    el.style.backgroundColor = urgent ? "#FF5252" : "#1E222D"
    el.style.color = urgent ? "#fff" : "#E2E8F0"
    el.style.opacity = "1"
  }

  // ===== MAIN CHART EFFECT (recreate on symbol/timeframe change) =====
  useEffect(() => {
    let dead = false
    let ro: ResizeObserver | null = null
    let winResizeCleanup: (() => void) | null = null
    let lastFrameAt = 0
    let watchdog: ReturnType<typeof setInterval> | null = null
    let onVisible: (() => void) | null = null

    async function boot() {
      if (!containerRef.current || dead) return
      if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
        if (!dead) setTimeout(boot, 30)
        return
      }

      const lwc = await getLwc()
      if (dead || !containerRef.current || !lwc?.createChart) return

      const CT = lwc.ColorType || { Solid: "solid" }
      const CM = lwc.CrosshairMode || { Normal: 0 }
      const LS = lwc.LineStyle || { Dashed: 1 }
      const isMobile = containerRef.current.clientWidth < 768

      // Bigger candles on shorter timeframes (broker-style zoom)
      const tf0 = latest.current.timeframe
      const barSpacing =
        tf0 === 60
          ? isMobile
            ? 16
            : 22
          : tf0 === 300
            ? isMobile
              ? 11
              : 15
            : isMobile
              ? 9
              : 12

      const chart = lwc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { type: CT.Solid, color: "rgba(0,0,0,0)" },
          textColor: "#787B86",
          fontSize: 11,
          fontFamily: "'SF Mono',Consolas,monospace",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(42, 46, 57, 0.4)" },
          horzLines: { color: "rgba(42, 46, 57, 0.4)" },
        },
        crosshair: {
          mode: CM.Normal,
          vertLine: { color: "rgba(255,255,255,0.35)", width: 1, style: LS.Dashed, labelBackgroundColor: "#2A2E39" },
          horzLine: { color: "rgba(255,255,255,0.35)", width: 1, style: LS.Dashed, labelBackgroundColor: "#2A2E39" },
        },
        rightPriceScale: { borderColor: "#363A45", autoScale: true, scaleMargins: { top: 0.12, bottom: 0.12 } },
        timeScale: {
          borderColor: "#363A45",
          timeVisible: true,
          secondsVisible: tf0 <= 60,
          barSpacing,
          minBarSpacing: 2,
          rightOffset: tf0 === 60 ? 12 : 8,
          shiftVisibleRangeOnNewBar: true,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: { time: true, price: true },
          axisDoubleClickReset: { time: true, price: true },
        },
        kineticScroll: { touch: true, mouse: false },
      })
      if (dead) {
        try {
          chart.remove()
        } catch {}
        return
      }

      // Precisao por ativo: garante que cada simbolo (inclusive memecoins com 8 casas) renderize corretamente
      const dec = getDecimals(latest.current.symbol, latest.current.currentPrice)
      const cOpts = {
        upColor: "#00E676",
        downColor: "#FF5252",
        borderUpColor: "#00E676",
        borderDownColor: "#FF5252",
        wickUpColor: "#00E676",
        wickDownColor: "#FF5252",
        priceLineVisible: true,
        priceLineColor: "#787B86",
        priceLineWidth: 1 as const,
        lastValueVisible: true,
        priceFormat: {
          type: "price" as const,
          precision: dec,
          minMove: Number((1 / Math.pow(10, dec)).toFixed(dec)),
        },
      }

      let cs: any
      try {
        cs = lwc.CandlestickSeries ? chart.addSeries(lwc.CandlestickSeries, cOpts) : (chart as any).addCandlestickSeries(cOpts)
      } catch {
        try {
          cs = (chart as any).addCandlestickSeries(cOpts)
        } catch {
          try {
            chart.remove()
          } catch {}
          return
        }
      }
      if (!cs || dead) {
        try {
          chart.remove()
        } catch {}
        return
      }

      chartRef.current = chart
      seriesRef.current = cs
      lwcRef.current = lwc
      // Sinaliza que a serie esta pronta para que as linhas de operacao/overlays
      // sejam (re)desenhadas — essencial ao voltar para uma moeda com operacao ativa.
      if (!dead) setSeriesReady((n) => n + 1)

      // Markers API (v5 uses createSeriesMarkers)
      try {
        if (lwc.createSeriesMarkers) {
          markersApiRef.current = lwc.createSeriesMarkers(cs, [])
        }
      } catch {}

      chart.subscribeCrosshairMove((p: any) => {
        if (!p?.seriesData) return
        const d = p.seriesData.get(cs)
        if (d && "open" in d) updateHeader(d as Candle, (d as Candle).close)
      })

      // Re-fit the chart to its container (used by ResizeObserver + window events)
      const refit = () => {
        if (!containerRef.current || !chartRef.current) return
        const w = containerRef.current.clientWidth
        const h = containerRef.current.clientHeight
        if (w > 0 && h > 0) {
          try {
            chartRef.current.applyOptions({ width: w, height: h })
          } catch {}
        }
      }

      ro = new ResizeObserver(() => refit())
      ro.observe(containerRef.current)

      // iOS Safari often doesn't fire ResizeObserver when the URL bar collapses/expands
      // or on orientation change, so refit on these window events too.
      const onWinResize = () => {
        refit()
        // run again after the mobile browser chrome settles
        setTimeout(refit, 250)
      }
      window.addEventListener("resize", onWinResize)
      window.addEventListener("orientationchange", onWinResize)
      winResizeCleanup = () => {
        window.removeEventListener("resize", onWinResize)
        window.removeEventListener("orientationchange", onWinResize)
      }

      // ===== (Re)configuracao + carga de dados na MESMA serie =====
      // Chamado na criacao e a cada troca de ativo/timeframe, SEM recriar o grafico
      // (elimina o flash/congelamento). Um token evita corridas entre cargas concorrentes.
      let loadToken = 0
      const loadData = () => {
        if (dead || !chartRef.current || !seriesRef.current) return
        const myToken = ++loadToken
        const sym = latest.current.symbol
        const tf = latest.current.timeframe
        const mob = containerRef.current ? containerRef.current.clientWidth < 768 : false
        const bs = tf === 60 ? (mob ? 16 : 22) : tf === 300 ? (mob ? 11 : 15) : mob ? 9 : 12

        // Bloqueia o loop de render de aplicar preco ate os novos dados chegarem
        loadedSymbolRef.current = null
        smoothPriceRef.current = 0
        formingRef.current = null
        prevTargetRef.current = 0

        // Reaplica opcoes que dependem do timeframe / precisao do ativo
        try {
          chartRef.current.timeScale().applyOptions({
            secondsVisible: tf <= 60,
            barSpacing: bs,
            rightOffset: tf === 60 ? 12 : 8,
          })
        } catch {}
        try {
          const dc = getDecimals(sym, latest.current.currentPrice)
          seriesRef.current.applyOptions({
            priceFormat: { type: "price", precision: dc, minMove: Number((1 / Math.pow(10, dc)).toFixed(dc)) },
          })
        } catch {}

        // ===== Historico CLIENT-SIDE (instantaneo, sem rede) =====
        // O motor de precos e puro/deterministico, entao construimos as ~24h de velas
        // localmente. Isso remove a dependencia do endpoint serverless (/api/global/history),
        // cujo cold start em producao segurava o grafico vazio/travado. Resultado: o grafico
        // aparece ja carregado na entrada e a troca de ativo e imediata.
        let baseData: Candle[] = []
        try {
          baseData = dedup(multiAssetEngine.getHistory(sym as any, tf) as Candle[])
        } catch {}
        if (baseData.length === 0) baseData = dedup(latest.current.candles || [])
        if (dead || myToken !== loadToken || !seriesRef.current) return

        if (baseData.length > 0) {
          try {
            seriesRef.current.setData(
              baseData.map((c) => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })),
            )
          } catch {}
          const last = baseData[baseData.length - 1]
          formingRef.current = { ...last }
          smoothPriceRef.current = last.close
          prevTargetRef.current = last.close
          updateHeader(last, last.close)

          // Posiciona o intervalo visivel: ultimas N velas preenchendo a largura, com a
          // vela atual proxima da borda direita. setVisibleLogicalRange preserva o auto-follow.
          try {
            const total = baseData.length
            const rightBars = tf === 60 ? 5 : 4
            const fit = Math.max(20, Math.floor((containerRef.current?.clientWidth || 600) / bs))
            const visibleCount = Math.min(total, fit - rightBars)
            chartRef.current.timeScale().setVisibleLogicalRange({
              from: total - visibleCount,
              to: total + rightBars,
            })
          } catch {}
        }
        loadedSymbolRef.current = sym
        setLoading(false)
        // Redesenha linhas de operacao/overlays sobre os novos dados
        setSeriesReady((n) => n + 1)
      }
      loadDataRef.current = loadData
      loadData()

      // ===== Aplicacao de um frame (preco -> vela) =====
      // Isolada para poder ser chamada tanto pelo requestAnimationFrame (60fps suave) quanto
      // pelo fallback de setInterval (garante atualizacao mesmo quando o rAF e estrangulado,
      // ex.: dentro de iframes/preview ou abas em segundo plano).
      const renderFrame = () => {
        if (dead || !seriesRef.current) return
        const sym = latest.current.symbol
        const tf = latest.current.timeframe
        // Le o preco vivo DIRETO do motor deterministico a cada frame, usando o simbolo atual.
        // Antes o preco vinha por props (hook -> pagina -> props -> latest.current), e essa
        // propagacao por re-render as vezes atrasava/congelava apos varias trocas rapidas de
        // ativo (o preco "parava" ate um foco/minimizar reiniciar o ciclo). Lendo direto do
        // motor — a mesma fonte pura e determinstica usada em loadData — o preco nunca fica preso
        // e sempre corresponde a escala da vela carregada (nao ha contaminacao entre ativos).
        let target = 0
        try {
          target = multiAssetEngine.getCurrentPrice(sym as any)
        } catch {
          target = latest.current.currentPrice
        }
        if (target > 0 && formingRef.current) {
          if (smoothPriceRef.current === 0) smoothPriceRef.current = target
          // Suavizacao relativa a escala do preco: funciona para qualquer magnitude
          // (forex, acoes, cripto e memecoins) sem depender do simbolo.
          const refPrice = smoothPriceRef.current || target
          const ratio = Math.abs(target - refPrice) / Math.max(Math.abs(refPrice), 1e-12)
          const alpha = ratio > 0.01 ? 0.8 : ratio > 0.002 ? 0.15 : ratio > 0.0005 ? 0.08 : 0.05
          smoothPriceRef.current += (target - smoothPriceRef.current) * alpha
          const price = smoothPriceRef.current

          const moveRatio = Math.abs(target - prevTargetRef.current) / Math.max(Math.abs(prevTargetRef.current), 1e-12)
          if (moveRatio > 0.00005) {
            dirRef.current = target > prevTargetRef.current ? "up" : "down"
            prevTargetRef.current = target
          }

          // New candle period?
          const nowSec = Math.floor(Date.now() / 1000)
          const newTime = Math.floor(nowSec / tf) * tf
          const f = formingRef.current
          if (newTime > f.time) {
            formingRef.current = { time: newTime, open: price, high: price, low: price, close: price }
          } else {
            f.close = price
            f.high = Math.max(f.high, price)
            f.low = Math.min(f.low, price)
          }
          try {
            seriesRef.current.update({
              time: formingRef.current.time as any,
              open: formingRef.current.open,
              high: formingRef.current.high,
              low: formingRef.current.low,
              close: formingRef.current.close,
            })
          } catch {}
          // O auto-follow ao criar nova vela e tratado por shiftVisibleRangeOnNewBar.
          updateHeader(formingRef.current, price)
          updateCountdown(price)
        }
        lastFrameAt = Date.now()
      }

      // ===== Loop suave a 60fps via requestAnimationFrame =====
      const tick = () => {
        if (dead) return
        renderFrame()
        animFrameRef.current = requestAnimationFrame(tick)
      }
      lastFrameAt = Date.now()
      animFrameRef.current = requestAnimationFrame(tick)

      // ===== Fallback garantido via setInterval =====
      // Alguns ambientes (preview em iframe, abas em segundo plano, alguns navegadores mobile)
      // estrangulam o requestAnimationFrame ate quase parar — o que deixa o grafico "travado".
      // Este intervalo aplica um frame diretamente se o rAF nao rodou nos ultimos ~250ms,
      // garantindo que o grafico SEMPRE continue atualizando, em qualquer ambiente.
      watchdog = setInterval(() => {
        if (dead || !seriesRef.current) return
        if (Date.now() - lastFrameAt > 250) {
          renderFrame()
        }
      }, 250)
      onVisible = () => {
        if (typeof document !== "undefined" && !document.hidden) {
          renderFrame()
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
          animFrameRef.current = requestAnimationFrame(tick)
        }
      }
      document.addEventListener("visibilitychange", onVisible)
      window.addEventListener("focus", onVisible)
    }

    boot()

    return () => {
      dead = true
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (watchdog) clearInterval(watchdog)
      if (onVisible) {
        document.removeEventListener("visibilitychange", onVisible)
        window.removeEventListener("focus", onVisible)
      }
      if (ro) ro.disconnect()
      if (winResizeCleanup) winResizeCleanup()
      if (chartRef.current) {
        try {
          chartRef.current.remove()
        } catch {}
      }
      chartRef.current = null
      seriesRef.current = null
      lwcRef.current = null
      markersApiRef.current = null
      loadDataRef.current = null
      loadedSymbolRef.current = null
      tradeLinesRef.current.clear()
      smoothPriceRef.current = 0
      formingRef.current = null
      prevTargetRef.current = 0
    }
    // Cria o grafico UMA unica vez (mount). A troca de ativo/timeframe apenas recarrega os
    // dados na mesma serie, sem recriar — por isso o grafico nunca "trava" nem pisca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recarrega os dados na serie existente quando o ativo ou o timeframe muda (instantaneo).
  useEffect(() => {
    loadDataRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe])

  // ===== TRADE LINES + MARKERS (native, attached to chart) =====
  useEffect(() => {
    const series = seriesRef.current
    const lwc = lwcRef.current
    if (!series) return

    // Remove old lines
    tradeLinesRef.current.forEach((l) => {
      try {
        series.removePriceLine(l)
      } catch {}
    })
    tradeLinesRef.current.clear()

    const LS = lwc?.LineStyle
    const markers: any[] = []

    activeTrades.forEach((trade) => {
      if (trade.entryPrice <= 0) return
      const cd = cds[trade.id] ?? -1
      if (cd <= 0) return
      const isCall = trade.direction === "call"
      const baseColor = isCall ? "#00E676" : "#FF5252"
      const isUrgent = cd <= 10
      const color = isUrgent ? "#FFC400" : baseColor
      const label = isCall ? "CALL" : "PUT"
      const m = Math.floor(cd / 60)
      const s = cd % 60
      const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      const amount = trade.amount ? ` R$${trade.amount.toFixed(0)}` : ""

      try {
        const line = series.createPriceLine({
          price: trade.entryPrice,
          color,
          lineWidth: 2,
          lineStyle: LS?.Dashed ?? 1,
          axisLabelVisible: true,
          title: ` ${isCall ? "▲" : "▼"} ${label} ${timeStr}${amount} `,
        })
        if (line) tradeLinesRef.current.set(trade.id, line)
      } catch {}

      // Entry marker on the candle
      markers.push({
        time: (Math.floor(trade.timestamp / 1000 / latest.current.timeframe) * latest.current.timeframe) as any,
        position: isCall ? "belowBar" : "aboveBar",
        color: baseColor,
        shape: isCall ? "arrowUp" : "arrowDown",
        text: label,
      })
    })

    // Apply markers
    try {
      if (markersApiRef.current?.setMarkers) {
        markersApiRef.current.setMarkers(markers)
      } else if (series.setMarkers) {
        series.setMarkers(markers)
      }
    } catch {}
  }, [activeTrades, cds, seriesReady])

  // ===== Live floating P&L overlays (IQ Option style) =====
  useEffect(() => {
    if (!activeTrades.length) {
      setPnlOverlays([])
      return
    }
    const payoutFrac = payout > 1 ? payout / 100 : payout
    const update = () => {
      const series = seriesRef.current
      if (!series) return
      const price = smoothPriceRef.current || latest.current.currentPrice
      const now = Date.now()
      const next: PnlOverlay[] = []
      activeTrades.forEach((t) => {
        if (t.entryPrice <= 0) return
        const remaining = Math.max(0, Math.ceil((t.timestamp + t.expiryTime * 1000 - now) / 1000))
        if (remaining <= 0) return
        let y: number | null = null
        try {
          y = series.priceToCoordinate(t.entryPrice)
        } catch {}
        if (y == null) return
        const isCall = t.direction === "call"
        // In binary options the result is "in the money" or not (tie counts as loss)
        const inMoney = isCall ? price > t.entryPrice : price < t.entryPrice
        const amount = t.amount || 10
        const pnl = inMoney ? Math.round(amount * payoutFrac * 100) / 100 : -amount
        const m = Math.floor(remaining / 60)
        const s = remaining % 60
        next.push({
          id: t.id,
          top: y,
          pnl,
          inMoney,
          isCall,
          time: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        })
      })
      setPnlOverlays(next)
    }
    update()
    const iv = setInterval(update, 60)
    return () => clearInterval(iv)
  }, [activeTrades, payout, seriesReady])

  // ===== WIN/LOSS result burst animation =====
  useEffect(() => {
    if (!result) return
    setResultBurst({ type: result.type, amount: result.amount, key: Date.now() })
    const to = setTimeout(() => setResultBurst(null), 2200)
    return () => clearTimeout(to)
  }, [result])

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: "#0d0d0f" }}>
      {/* Marca d'agua Kodilex no fundo do grafico */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url(/images/kodilex-watermark.png)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 45%",
          backgroundSize: "55% auto",
          opacity: 0.4,
        }}
      />
      {/* Vinheta sutil para dar profundidade */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(13,13,15,0) 55%, rgba(13,13,15,0.85) 100%)",
        }}
      />
      {/* OHLC header */}
      <div
        ref={headerRef}
        className="absolute top-2 left-3 z-20 flex items-center pointer-events-none"
        style={{ fontFamily: "'SF Mono',Consolas,monospace" }}
      />

      {/* Contador regressivo do fechamento da vela (estilo IQ Option) */}
      <div
        ref={countdownRef}
        className="absolute right-[62px] z-20 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums pointer-events-none"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "'SF Mono',Consolas,monospace",
          opacity: 0,
        }}
      />

      {/* Chart container - touchAction none lets the chart capture drag instead of the page scrolling */}
      <div ref={containerRef} className="absolute inset-0 z-10" style={{ touchAction: "none" }} />

      {/* Camada de desenho (marcacoes) - so captura eventos quando uma ferramenta esta ativa */}
      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 z-[15]"
        style={{
          touchAction: "none",
          pointerEvents: tool === "cursor" ? "none" : "auto",
          cursor: tool === "eraser" ? "not-allowed" : tool === "cursor" ? "default" : "crosshair",
        }}
        onPointerDown={handleDrawPointerDown}
        onPointerMove={handleDrawPointerMove}
        onPointerUp={handleDrawPointerUp}
      />

      {/* Barra de ferramentas de desenho (estilo IQ Option) */}
      <div className="absolute top-1/2 left-2 z-30 -translate-y-1/2 flex flex-col items-center gap-1 rounded-xl border border-[#2A2E39] bg-[#0d0d0f]/90 p-1 backdrop-blur-sm">
        {DRAW_TOOLS.map((dt) => {
          const active = tool === dt.id
          return (
            <button
              key={dt.id}
              type="button"
              title={dt.label}
              aria-label={dt.label}
              onClick={() => setTool(active && dt.id !== "cursor" ? "cursor" : dt.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={{
                backgroundColor: active ? "#9333ea" : "transparent",
                color: active ? "#fff" : "#94A3B8",
              }}
            >
              {dt.icon}
            </button>
          )
        })}

        <div className="my-0.5 h-px w-6 bg-[#2A2E39]" />

        {/* Seletor de cor */}
        <div className="relative">
          <button
            type="button"
            title="Cor"
            aria-label="Selecionar cor"
            onClick={() => setShowColors((s) => !s)}
            className="flex h-8 w-8 items-center justify-center rounded-lg"
          >
            <span className="h-4 w-4 rounded-full border border-white/30" style={{ backgroundColor: drawColor }} />
          </button>
          {showColors && (
            <div className="absolute left-10 top-0 flex gap-1 rounded-lg border border-[#2A2E39] bg-[#0d0d0f] p-1.5">
              {DRAW_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => {
                    setDrawColor(c)
                    setShowColors(false)
                  }}
                  className="h-5 w-5 rounded-full border transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: c === drawColor ? "#fff" : "transparent" }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Limpar tudo */}
        <button
          type="button"
          title="Limpar tudo"
          aria-label="Limpar todas as marcacoes"
          onClick={() => {
            setDrawings([])
            draftRef.current = null
          }}
          disabled={drawings.length === 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:text-[#FF5252] disabled:opacity-30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Relogio minimizado (UTC-3) no canto inferior esquerdo */}
      {clock && (
        <div
          className="absolute bottom-2 left-3 z-20 pointer-events-none flex items-center gap-1"
          style={{ fontFamily: "'SF Mono',Consolas,monospace" }}
        >
          <span className="w-1 h-1 rounded-full bg-[#00E676]" />
          <span className="text-[10px] font-medium text-[#787B86] tabular-nums tracking-tight">
            {clock} UTC-3
          </span>
        </div>
      )}

      {/* Live floating P&L above each open operation */}
      {pnlOverlays.map((o) => {
        const clr = o.inMoney ? "#00E676" : "#FF5252"
        return (
          <div
            key={o.id}
            className="absolute z-20 pointer-events-none"
            style={{
              top: o.top,
              right: 72,
              transform: "translateY(-50%)",
              transition: "top 0.12s linear",
            }}
          >
            <div
              className="flex flex-col items-end gap-0.5"
              style={{ animation: "pnlPop 0.3s ease-out" }}
            >
              <div
                className="px-2 py-1 rounded-md font-bold text-xs whitespace-nowrap"
                style={{
                  background: "rgba(13,13,15,0.92)",
                  color: clr,
                  border: `1px solid ${clr}`,
                  boxShadow: `0 0 10px ${clr}55`,
                  fontFamily: "'SF Mono',Consolas,monospace",
                }}
              >
                {o.pnl >= 0 ? "+" : "-"}R${" "}
                {Math.abs(o.pnl).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
                style={{
                  background: "rgba(13,13,15,0.85)",
                  color: o.isCall ? "#00E676" : "#FF5252",
                  fontFamily: "'SF Mono',Consolas,monospace",
                }}
              >
                {o.isCall ? "▲" : "▼"} {o.time}
              </div>
            </div>
          </div>
        )
      })}

      {/* WIN / LOSS result animation */}
      {resultBurst && (
        <div
          key={resultBurst.key}
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
        >
          <div
            className="flex flex-col items-center gap-2"
            style={{ animation: "resultBurst 2.2s ease-out forwards" }}
          >
            <span
              className="text-5xl font-black tracking-tight"
              style={{
                color: resultBurst.type === "win" ? "#00E676" : "#FF5252",
                textShadow: `0 0 30px ${resultBurst.type === "win" ? "#00E676" : "#FF5252"}`,
              }}
            >
              {resultBurst.type === "win" ? "WIN" : "LOSS"}
            </span>
            <span
              className="text-2xl font-bold"
              style={{ color: resultBurst.type === "win" ? "#00E676" : "#FF5252" }}
            >
              {resultBurst.type === "win" ? "+" : "-"}R${" "}
              {resultBurst.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30" style={{ backgroundColor: "#0d0d0f" }}>
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-[#1a1a1e] border-t-[#00E676] animate-spin"
              aria-hidden
            />
            <span className="text-[#787B86] text-xs">Carregando grafico...</span>
          </div>
        </div>
      )}

      {/* Buy/Sell flash animation */}
      {flash && (
        <div
          key={flash.id}
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${flash.dir === "call" ? "rgba(0,230,118,0.25)" : "rgba(255,82,82,0.25)"} 0%, transparent 60%)`,
            animation: "chartFlash 0.7s ease-out forwards",
          }}
        />
      )}

      <style>{`
        @keyframes chartFlash {
          0% { opacity: 0; }
          25% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pnlPop {
          0% { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes resultBurst {
          0% { transform: scale(0.4); opacity: 0; }
          15% { transform: scale(1.15); opacity: 1; }
          30% { transform: scale(1); opacity: 1; }
          75% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export function MarketChart(props: Props) {
  return (
    <ChartErrorBoundary>
      <ChartCore {...props} />
    </ChartErrorBoundary>
  )
}
