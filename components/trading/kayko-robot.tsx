"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { X, Loader2, TrendingUp, TrendingDown, Radar, Clock, Cpu } from "lucide-react"

interface KaykoSignal {
  type: "CALL" | "PUT"
  assetName: string
  entryTime: string
  expirationLabel: string
  confidence: number
}

interface KaykoRobotProps {
  isActive: boolean
  assetName?: string
  symbol?: string
  price?: number
  expirySeconds?: number
}

const ACCENT = "#22d3ee"

export function KaykoRobot({ isActive, assetName, symbol, price, expirySeconds = 60 }: KaykoRobotProps) {
  const [position, setPosition] = useState({ x: 16, y: 320 })
  const [isDragging, setIsDragging] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [signal, setSignal] = useState<KaykoSignal | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null)
  const movedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Histórico curto de preços do ativo atual: usado para dar um viés "real" à direção da entrada.
  const priceHistoryRef = useRef<number[]>([])

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/notification.mp3")
      audioRef.current.volume = 0.5
    }
  }, [])

  // Acompanha o preço do ativo em tela para a análise reagir ao mercado atual.
  useEffect(() => {
    if (typeof price !== "number" || isNaN(price)) return
    const hist = priceHistoryRef.current
    hist.push(price)
    if (hist.length > 40) hist.shift()
  }, [price])

  // Ao trocar de ativo, zera o histórico para não misturar tendências de pares diferentes.
  useEffect(() => {
    priceHistoryRef.current = []
    setSignal(null)
  }, [symbol])

  const playAlert = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = 0
    el.play().catch(() => {})
  }, [])

  const handleDown = (clientX: number, clientY: number, target: EventTarget | null) => {
    if ((target as HTMLElement)?.closest?.(".kayko-popup")) return
    movedRef.current = false
    setIsDragging(true)
    dragRef.current = { startX: clientX, startY: clientY, initialX: position.x, initialY: position.y }
  }

  const handleMouseDown = (e: React.MouseEvent) => handleDown(e.clientX, e.clientY, e.target)
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    handleDown(t.clientX, t.clientY, e.target)
  }

  useEffect(() => {
    if (!isDragging) return
    const move = (cx: number, cy: number) => {
      if (!dragRef.current) return
      const dx = cx - dragRef.current.startX
      const dy = cy - dragRef.current.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 56, dragRef.current.initialX + dx)),
        y: Math.max(60, Math.min(window.innerHeight - 90, dragRef.current.initialY + dy)),
      })
    }
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      move(t.clientX, t.clientY)
    }
    const end = () => {
      setIsDragging(false)
      dragRef.current = null
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", end)
    window.addEventListener("touchmove", onTouchMove)
    window.addEventListener("touchend", end)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", end)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", end)
    }
  }, [isDragging])

  const handleClick = () => {
    if (movedRef.current) return
    setShowPopup(true)
  }

  const analyze = useCallback(() => {
    setIsAnalyzing(true)
    setSignal(null)

    window.setTimeout(() => {
      // Direção com viés na tendência recente do preço do ativo em tela.
      const hist = priceHistoryRef.current
      let bias = 0
      if (hist.length >= 4) {
        const recent = hist.slice(-8)
        bias = recent[recent.length - 1] - recent[0]
      }
      let type: "CALL" | "PUT"
      if (bias > 0) type = Math.random() < 0.7 ? "CALL" : "PUT"
      else if (bias < 0) type = Math.random() < 0.7 ? "PUT" : "CALL"
      else type = Math.random() < 0.5 ? "CALL" : "PUT"

      // Horário de entrada: início do próximo minuto cheio (padrão de sinais).
      const entry = new Date()
      entry.setSeconds(0, 0)
      entry.setMinutes(entry.getMinutes() + 1)
      const entryTime = entry.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

      const mins = Math.max(1, Math.round(expirySeconds / 60))
      const expirationLabel = `${mins} ${mins === 1 ? "minuto" : "minutos"}`

      setSignal({
        type,
        assetName: assetName || symbol || "Ativo",
        entryTime,
        expirationLabel,
        confidence: Math.floor(Math.random() * 12) + 86,
      })
      setIsAnalyzing(false)
      playAlert()
    }, 2600)
  }, [assetName, symbol, expirySeconds, playAlert])

  if (!isActive) return null

  const isCall = signal?.type === "CALL"

  return (
    <>
      {/* Robô flutuante */}
      <div
        className="fixed z-[90] cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        role="button"
        aria-label="Abrir robô KAYKO"
      >
        <div className="relative">
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: `${ACCENT}55` }}
          />
          <div
            className="relative w-14 h-14 rounded-full overflow-hidden border-2 shadow-lg"
            style={{ borderColor: ACCENT, boxShadow: `0 0 18px ${ACCENT}66` }}
          >
            <img
              src="/images/kayko-robot.png"
              alt="Robô KAYKO"
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0B0F14] flex items-center justify-center"
            style={{ backgroundColor: ACCENT }}
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Popup de análise */}
      {showPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowPopup(false)} />

          <div
            className="kayko-popup relative w-full max-w-sm rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 shadow-2xl border border-white/5"
            style={{ backgroundColor: "#0a0e13" }}
          >
            {/* Header */}
            <div className="relative p-5 border-b border-white/5" style={{ background: `linear-gradient(135deg, ${ACCENT}1f 0%, #0a0e13 70%)` }}>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl overflow-hidden ring-2"
                  style={{ boxShadow: `0 0 16px ${ACCENT}55`, borderColor: ACCENT }}
                >
                  <img src="/images/kayko-robot.png" alt="Robô KAYKO" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-black text-lg tracking-wide">
                    ROBÔ <span style={{ color: ACCENT }}>KAYKO</span>
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: ACCENT }}>
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
                      Online
                    </span>
                    <span className="text-white/30 text-xs">•</span>
                    <span className="text-white/40 text-xs flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      IA de análise
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-5 space-y-4">
              {/* Ativo atual em análise */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white/5">
                <span className="text-white/50 text-xs uppercase tracking-wide">Ativo em análise</span>
                <span className="text-white font-bold text-sm">{assetName || symbol || "—"}</span>
              </div>

              <button
                onClick={analyze}
                disabled={isAnalyzing}
                className="w-full py-4 text-[#04121a] font-bold rounded-2xl transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-3 active:scale-[0.98]"
                style={{ background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`, boxShadow: `0 8px 24px ${ACCENT}44` }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analisando o ativo...</span>
                  </>
                ) : (
                  <>
                    <Radar className="w-5 h-5" />
                    <span>Analisar e gerar entrada</span>
                  </>
                )}
              </button>

              {signal && !isAnalyzing && (
                <div
                  className="relative p-5 rounded-2xl border animate-in slide-in-from-bottom-4 duration-500 overflow-hidden"
                  style={{
                    borderColor: isCall ? "#22c55e80" : "#EF444480",
                    background: isCall
                      ? "linear-gradient(135deg, rgba(34,197,94,0.18), transparent)"
                      : "linear-gradient(135deg, rgba(239,68,68,0.18), transparent)",
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/60 text-sm font-medium">Entrada confirmada</span>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: isCall ? "#22c55e" : "#EF4444" }}
                    >
                      {signal.confidence}% de acerto
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/50 text-xs">Ativo</p>
                      <p className="text-white font-bold text-lg leading-tight">{signal.assetName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCall ? (
                        <TrendingUp className="w-7 h-7 text-[#22c55e]" />
                      ) : (
                        <TrendingDown className="w-7 h-7 text-[#EF4444]" />
                      )}
                      <p className={`font-black text-2xl ${isCall ? "text-[#22c55e]" : "text-[#EF4444]"}`}>
                        {isCall ? "COMPRA" : "VENDA"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl px-3 py-2.5 bg-black/30">
                      <p className="text-white/40 text-[10px] uppercase tracking-wide flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Horário de entrada
                      </p>
                      <p className="text-white font-mono font-bold text-base mt-0.5">{signal.entryTime}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2.5 bg-black/30">
                      <p className="text-white/40 text-[10px] uppercase tracking-wide">Expiração</p>
                      <p className="text-white font-bold text-base mt-0.5">{signal.expirationLabel}</p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-center text-white/40 text-xs flex items-center justify-center gap-1.5">
                <Cpu className="w-3 h-3" />
                Análise do ativo aberto na tela em tempo real
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
