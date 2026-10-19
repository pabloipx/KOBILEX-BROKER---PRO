"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { X, Loader2, Radar, Cpu } from "lucide-react"
import { subscribeLivePrice, getLivePrice } from "@/lib/price-engine/live-price-store"
import { TRADER_PRO, TRADE_RESULT_EVENT, type RobotConfig } from "@/lib/robots"
import { CronosEye, CronosEyeStyles, CronosStage } from "@/components/trading/cronos-eye"
import { CronosEyeIcon } from "@/components/trading/cronos-eye-icon"
import { RobotSignalTimer, type RobotSignal } from "@/components/trading/robot-signal-card"

type KaykoSignal = RobotSignal

interface KaykoRobotProps {
  isActive: boolean
  assetName?: string
  symbol?: string
  expirySeconds?: number
  robot?: RobotConfig
  initialY?: number
}

interface KaykoScore {
  win: number
  loss: number
  profit: number
}

function readActivatedAt(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

export function KaykoRobot({ isActive, assetName, symbol, expirySeconds = 60, robot = TRADER_PRO, initialY = 130 }: KaykoRobotProps) {
  const ACCENT = robot.robotAccent
  const SCORE_KEY = robot.scoreKey
  const ACTIVATED_KEY = robot.activatedAtKey
  const getActivatedAt = () => readActivatedAt(ACTIVATED_KEY)
  const [position, setPosition] = useState({ x: 16, y: initialY })
  const [isDragging, setIsDragging] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null)
  const analysisTimerRef = useRef<number | null>(null)
  const isCronos = robot.id === "cronos"
  const analysisDurationMs = isCronos ? 22000 : 2600
  const [signal, setSignal] = useState<KaykoSignal | null>(null)
  const [score, setScore] = useState<KaykoScore>({ win: 0, loss: 0, profit: 0 })
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null)
  const movedRef = useRef(false)
  const popupResultRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Histórico curto de preços do ativo atual: usado para dar um viés "real" à direção da entrada.
  const priceHistoryRef = useRef<number[]>([])

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/notification.mp3")
      audioRef.current.volume = 0.5
    }
  }, [])

  useEffect(() => {
    if (!showPopup || !signal || isAnalyzing) return
    // Espera o cartão do resultado montar antes de rolar o pop-up até ele.
    const frame = window.requestAnimationFrame(() => {
      popupResultRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [showPopup, signal, isAnalyzing])

  // Carrega o placar do dispositivo, mas SOMENTE se ele pertence à ativação atual.
  // O placar fica atrelado ao carimbo de ativação (kayko_activated_at): qualquer placar
  // de uma ativação anterior (ou legado sem carimbo) é zerado — assim, ao ativar, começa
  // sempre em 0 x 0 e só sobe pelo resultado real das entradas feitas depois de ativar.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      let activatedAt = getActivatedAt()
      // Ativação legada sem carimbo: cria um agora para o placar contar a partir daqui.
      if (isActive && activatedAt === 0) {
        activatedAt = Date.now()
        localStorage.setItem(ACTIVATED_KEY, String(activatedAt))
      }
      const raw = localStorage.getItem(SCORE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as KaykoScore & { for?: number }
        if (typeof parsed?.win === "number" && parsed.for === activatedAt) {
          setScore({ win: parsed.win, loss: parsed.loss ?? 0, profit: parsed.profit ?? 0 })
          return
        }
      }
      // Placar de outra ativação (ou legado) => começa 0 x 0 para esta ativação.
      const zero: KaykoScore = { win: 0, loss: 0, profit: 0 }
      setScore(zero)
      localStorage.setItem(SCORE_KEY, JSON.stringify({ ...zero, for: activatedAt }))
    } catch {}
  }, [isActive])

  // O placar sobe pelo resultado real de cada operação encerrada na tela de trade.
  // A própria página dispara "kayko:trade-result" ao fechar uma entrada (win/loss + lucro).
  useEffect(() => {
    if (typeof window === "undefined") return
    const onResult = (e: Event) => {
      const detail = (e as CustomEvent<{ result?: "win" | "loss"; profit?: number; openedAt?: number }>).detail
      if (!detail || (detail.result !== "win" && detail.result !== "loss")) return
      // Só conta entradas abertas a partir do momento da ativação — entradas que já
      // estavam abertas antes de ativar o robô não entram no placar.
      const activatedAt = getActivatedAt()
      if (activatedAt > 0 && typeof detail.openedAt === "number" && detail.openedAt < activatedAt) return
      const won = detail.result === "win"
      const delta = typeof detail.profit === "number" ? detail.profit : 0
      setScore((prev) => {
        const next: KaykoScore = {
          win: prev.win + (won ? 1 : 0),
          loss: prev.loss + (won ? 0 : 1),
          profit: Math.round((prev.profit + delta) * 100) / 100,
        }
        try {
          localStorage.setItem(SCORE_KEY, JSON.stringify({ ...next, for: activatedAt }))
        } catch {}
        return next
      })
    }
    window.addEventListener(TRADE_RESULT_EVENT, onResult as EventListener)
    return () => window.removeEventListener(TRADE_RESULT_EVENT, onResult as EventListener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SCORE_KEY, ACTIVATED_KEY])

  // Placar definido manualmente pelo admin (tela de perfil). Atualiza o flutuante ao vivo.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent<Partial<KaykoScore>>).detail
      if (!detail) return
      setScore({
        win: Math.max(0, Math.floor(detail.win ?? 0)),
        loss: Math.max(0, Math.floor(detail.loss ?? 0)),
        profit: Math.round((detail.profit ?? 0) * 100) / 100,
      })
    }
    window.addEventListener(robot.scoreSetEvent, onSet as EventListener)
    return () => window.removeEventListener(robot.scoreSetEvent, onSet as EventListener)
  }, [robot.scoreSetEvent])

  // Acompanha o preço do ativo em tela para a análise reagir ao mercado atual.
  // Assina o live-price-store diretamente (em vez de receber `price` por prop), para o robô NÃO
  // forçar a página de trade a re-renderizar no tick de preço. Alimenta apenas um ref, sem setState.
  useEffect(() => {
    const unsub = subscribeLivePrice(() => {
      const p = getLivePrice()
      if (typeof p !== "number" || isNaN(p) || p <= 0) return
      const hist = priceHistoryRef.current
      hist.push(p)
      if (hist.length > 40) hist.shift()
    })
    return unsub
  }, [])

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
    setAnalysisStartedAt(Date.now())

    if (analysisTimerRef.current) window.clearTimeout(analysisTimerRef.current)
    analysisTimerRef.current = window.setTimeout(() => {
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

      // Horário de entrada: sempre de 4 a 5 minutos à frente do momento do sinal,
      // no início do minuto cheio (padrão de sinais).
      const entry = new Date()
      entry.setSeconds(0, 0)
      const minutesAhead = Math.random() < 0.5 ? 4 : 5
      entry.setMinutes(entry.getMinutes() + minutesAhead)
      const confidence = Math.floor(Math.random() * 12) + 86

      setSignal({
        type,
        assetName: assetName || symbol || "Ativo",
        entryAt: entry.getTime(),
        expirySeconds: Math.max(30, expirySeconds),
        confidence,
      })

      // A análise apenas gera o sinal. O placar NÃO muda aqui — ele só sobe pelo
      // resultado real da operação quando ela é encerrada na tela de trade.
      setIsAnalyzing(false)
      setAnalysisStartedAt(null)
      playAlert()
    }, analysisDurationMs)
  }, [assetName, symbol, expirySeconds, playAlert, analysisDurationMs])

  useEffect(() => {
    return () => {
      if (analysisTimerRef.current) window.clearTimeout(analysisTimerRef.current)
    }
  }, [])

  const clearSignal = useCallback(() => {
    window.setTimeout(() => setSignal(null), 4000)
  }, [])

  if (!isActive) return null

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
        aria-label={`Abrir robô ${robot.name}`}
      >
        <div className="flex flex-col items-center">
          <div className={isCronos ? "relative w-[132px] h-[84px] md:w-[176px] md:h-[112px] mb-1" : "relative w-20 h-20 md:w-28 md:h-28"}>
            {!isCronos && (
              <span
                className="absolute left-1/2 top-1/2 w-14 h-14 md:w-20 md:h-20 -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
                style={{ backgroundColor: `${ACCENT}44` }}
              />
            )}
            {isCronos ? (
              <>
                <CronosEyeStyles />
                <CronosEyeIcon analyzing={isAnalyzing} className="w-full h-full" />
              </>
            ) : (
              <img
                src={robot.image || "/placeholder.svg"}
                alt={`Robô ${robot.name}`}
                className="relative w-full h-full object-contain"
                style={{ filter: `drop-shadow(0 0 12px ${ACCENT}aa) drop-shadow(0 2px 6px rgba(0,0,0,0.7))` }}
                draggable={false}
              />
            )}
            <div
              className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#0B0F14] flex items-center justify-center"
              style={{ backgroundColor: ACCENT }}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>
          </div>

          <div
            className="mt-1 flex items-stretch overflow-hidden rounded-full border bg-[#0B0F14]/85 backdrop-blur-md shadow-lg text-[11px] md:text-xs font-bold tabular-nums"
            style={{ borderColor: `${ACCENT}55`, boxShadow: `0 0 14px -4px ${ACCENT}88` }}
            aria-label={`Placar: ${score.win} win, ${score.loss} loss`}
          >
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              WIN <span className="text-white">{score.win}</span>
            </span>
            <span className="w-px bg-white/10" aria-hidden="true" />
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true" />
              LOSS <span className="text-white">{score.loss}</span>
            </span>
          </div>

          {signal && !isAnalyzing && (
            <div className="mt-1.5 w-[180px] md:w-[220px] rounded-2xl backdrop-blur-md shadow-xl">
              <RobotSignalTimer signal={signal} onFinish={clearSignal} />
            </div>
          )}
        </div>
      </div>

      {/* Popup de análise */}
      {showPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowPopup(false)} />

          <div
            className="kayko-popup relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl animate-in fade-in zoom-in-95 duration-300 shadow-2xl border"
            style={{
              backgroundColor: isCronos ? "#080604" : "#0a0e13",
              borderColor: isCronos ? "rgba(250,204,21,0.25)" : "rgba(255,255,255,0.05)",
              boxShadow: isCronos ? "0 0 60px -10px rgba(250,204,21,0.35)" : undefined,
            }}
          >
            {/* Header */}
            <div className="relative p-5 border-b border-white/5" style={{ background: `linear-gradient(135deg, ${ACCENT}1f 0%, #0a0e13 70%)` }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 flex items-center justify-center shrink-0">
                  {isCronos ? (
                    <CronosEye showRings={false} scanning={isAnalyzing} className="w-full h-full" />
                  ) : (
                    <img
                      src={robot.image || "/placeholder.svg"}
                      alt={`Robô ${robot.name}`}
                      className="w-full h-full object-contain"
                      style={{ filter: `drop-shadow(0 0 8px ${ACCENT}88)` }}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-black text-lg tracking-wide">
                    <span style={{ color: ACCENT }}>{robot.name}</span>
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
              {isCronos && (
                <CronosStage
                  analyzing={isAnalyzing}
                  startedAt={analysisStartedAt}
                  durationMs={analysisDurationMs}
                  assetName={assetName || symbol}
                />
              )}

              {/* Ativo atual em análise */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white/5">
                <span className="text-white/50 text-xs uppercase tracking-wide">Ativo em análise</span>
                <span className="text-white font-bold text-sm">{assetName || symbol || "—"}</span>
              </div>

              <button
                onClick={analyze}
                disabled={isAnalyzing}
                className="w-full py-4 text-[#04121a] font-bold rounded-2xl transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-3 active:scale-[0.98]"
                style={{ background: `linear-gradient(90deg, ${ACCENT}, ${robot.robotAccentTo})`, boxShadow: `0 8px 24px ${ACCENT}44` }}
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
                  ref={popupResultRef}
                  className="space-y-3 scroll-mb-4 animate-in slide-in-from-bottom-4 duration-500"
                >
                  <RobotSignalTimer signal={signal} size="lg" />
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
