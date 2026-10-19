"use client"

import { useEffect, useState } from "react"
import { Clock, TrendingDown, TrendingUp } from "lucide-react"

export interface RobotSignal {
  type: "CALL" | "PUT"
  assetName: string
  entryAt: number
  expirySeconds: number
  confidence: number
}

export interface RobotScore {
  win: number
  loss: number
  profit: number
}

const GREEN = "#22c55e"
const RED = "#ef4444"

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
}

function formatMoney(value: number) {
  return Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Size = "sm" | "lg"

export function RobotScoreBoard({ score, size = "sm" }: { score: RobotScore; size?: Size }) {
  const total = score.win + score.loss
  const rate = total > 0 ? Math.round((score.win / total) * 100) : 0
  const lg = size === "lg"
  const pill = lg ? "h-12 px-4" : "h-8 px-2.5"
  const label = lg ? "text-sm" : "text-[10px]"
  const value = lg ? "text-2xl" : "text-base"

  return (
    <div className={lg ? "space-y-3" : "space-y-1.5"}>
      <div className={`grid grid-cols-2 ${lg ? "gap-2" : "gap-1"}`}>
        <div
          className={`${pill} rounded-full border flex items-center justify-between`}
          style={{ backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.35)" }}
        >
          <span className={`${label} font-bold uppercase`} style={{ color: GREEN }}>
            Win
          </span>
          <span className={`${value} font-black text-white tabular-nums leading-none`}>{score.win}</span>
        </div>
        <div
          className={`${pill} rounded-full border flex items-center justify-between`}
          style={{ backgroundColor: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)" }}
        >
          <span className={`${label} font-bold uppercase`} style={{ color: RED }}>
            Loss
          </span>
          <span className={`${value} font-black text-white tabular-nums leading-none`}>{score.loss}</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-1">
        <span
          className={`${lg ? "text-2xl" : "text-sm"} font-black tabular-nums`}
          style={{ color: score.profit >= 0 ? GREEN : RED }}
        >
          {score.profit >= 0 ? "+" : "-"}R$ {formatMoney(score.profit)}
        </span>
        <span className={`${lg ? "text-2xl" : "text-sm"} font-black text-white/80 tabular-nums`}>{rate}%</span>
      </div>
    </div>
  )
}

export function RobotSignalTimer({
  signal,
  size = "sm",
  onFinish,
}: {
  signal: RobotSignal
  size?: Size
  onFinish?: () => void
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const endAt = signal.entryAt + signal.expirySeconds * 1000
  const finished = now >= endAt

  useEffect(() => {
    if (finished) onFinish?.()
  }, [finished, onFinish])

  const isCall = signal.type === "CALL"
  const color = isCall ? GREEN : RED
  const inOperation = now >= signal.entryAt
  const remaining = inOperation ? (endAt - now) / 1000 : (signal.entryAt - now) / 1000
  const lg = size === "lg"
  const Icon = isCall ? TrendingUp : TrendingDown

  return (
    <div
      className={`rounded-2xl border ${lg ? "p-4" : "p-2.5"}`}
      style={{
        backgroundColor: isCall ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
        borderColor: isCall ? "rgba(34,197,94,0.40)" : "rgba(239,68,68,0.40)",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`shrink-0 ${lg ? "w-6 h-6" : "w-3.5 h-3.5"}`} style={{ color }} aria-hidden="true" />
          <span className={`${lg ? "text-2xl tracking-wide" : "text-[13px]"} font-black`} style={{ color }}>
            {isCall ? "COMPRAR" : "VENDER"}
          </span>
        </div>
        <span className={`shrink-0 flex items-center gap-0.5 text-white/60 tabular-nums ${lg ? "text-base" : "text-[10px]"}`}>
          <Clock className={lg ? "w-4 h-4" : "w-3 h-3"} aria-hidden="true" />
          {formatClock(signal.expirySeconds)}
        </span>
      </div>

      {lg && (
        <p className="mt-1 text-xs text-white/50 truncate">
          {signal.assetName} • {signal.confidence}% de acerto
        </p>
      )}

      <div className={`flex items-end justify-between gap-2 ${lg ? "mt-4" : "mt-2"}`}>
        <span className={`uppercase text-white/50 leading-tight ${lg ? "text-sm" : "text-[9px]"}`}>
          {finished ? "Finalizada" : inOperation ? "Encerra em" : "Entrar em"}
        </span>
        <span
          className={`font-black tabular-nums leading-none ${lg ? "text-4xl" : "text-xl"}`}
          style={{ color: inOperation && !finished ? color : "#fff" }}
        >
          {formatClock(finished ? 0 : remaining)}
        </span>
      </div>
    </div>
  )
}
