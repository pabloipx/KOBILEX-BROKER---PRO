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
  const [mountedAt] = useState(() => Date.now())

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
  const rgb = isCall ? "34,197,94" : "239,68,68"

  const phaseStart = inOperation ? signal.entryAt : Math.min(mountedAt, signal.entryAt)
  const phaseTotal = inOperation ? signal.expirySeconds * 1000 : Math.max(1, signal.entryAt - phaseStart)
  const progress = finished ? 0 : Math.min(1, Math.max(0, remaining * 1000 / phaseTotal))
  const statusLabel = finished ? "Finalizada" : inOperation ? "Encerra em" : "Entrar em"

  return (
    <div
      className={`relative overflow-hidden border ${lg ? "rounded-3xl p-4" : "rounded-2xl p-2.5"}`}
      style={{
        background: `linear-gradient(145deg, rgba(${rgb},0.22) 0%, rgba(${rgb},0.06) 45%, rgba(8,10,14,0.92) 100%)`,
        borderColor: `rgba(${rgb},0.45)`,
        boxShadow: `0 0 ${lg ? 32 : 18}px -8px rgba(${rgb},0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute -top-10 -right-10 rounded-full blur-2xl"
        style={{ width: lg ? 140 : 80, height: lg ? 140 : 80, backgroundColor: `rgba(${rgb},0.25)` }}
        aria-hidden="true"
      />

      <div className="relative flex items-center justify-between gap-2">
        <div className={`flex items-center min-w-0 ${lg ? "gap-3" : "gap-1.5"}`}>
          <span
            className={`shrink-0 flex items-center justify-center rounded-xl ${lg ? "w-11 h-11" : "w-6 h-6 rounded-lg"}`}
            style={{ backgroundColor: `rgba(${rgb},0.18)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4)` }}
          >
            <Icon className={lg ? "w-6 h-6" : "w-3.5 h-3.5"} style={{ color }} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {lg && (
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Sinal</span>
            )}
            <span
              className={`block font-black leading-none ${lg ? "text-2xl tracking-wide" : "text-[13px]"}`}
              style={{ color, textShadow: `0 0 18px rgba(${rgb},0.5)` }}
            >
              {isCall ? "COMPRAR" : "VENDER"}
            </span>
          </div>
        </div>
        <span
          className={`shrink-0 flex items-center gap-1 rounded-full text-white/80 tabular-nums font-semibold ${
            lg ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[9px]"
          }`}
          style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
        >
          <Clock className={lg ? "w-3.5 h-3.5" : "w-2.5 h-2.5"} aria-hidden="true" />
          {formatClock(signal.expirySeconds)}
        </span>
      </div>

      {lg && (
        <div className="relative mt-3 flex items-center gap-2 text-xs">
          <span className="truncate rounded-full bg-white/[0.06] px-2.5 py-1 text-white/70">{signal.assetName}</span>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 font-semibold"
            style={{ backgroundColor: `rgba(${rgb},0.14)`, color }}
          >
            {signal.confidence}% de acerto
          </span>
        </div>
      )}

      <div
        className={`relative rounded-2xl ${lg ? "mt-4 px-4 py-3" : "mt-2 px-2 py-1.5 rounded-xl"}`}
        style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`uppercase font-semibold text-white/55 leading-tight ${lg ? "text-xs tracking-[0.18em]" : "text-[8px] tracking-wider"}`}
          >
            {statusLabel}
          </span>
          <span
            className={`font-black tabular-nums leading-none ${lg ? "text-4xl" : "text-lg"}`}
            style={{ color: inOperation && !finished ? color : "#fff" }}
          >
            {formatClock(finished ? 0 : remaining)}
          </span>
        </div>
        <div
          className={`overflow-hidden rounded-full bg-white/10 ${lg ? "mt-3 h-1.5" : "mt-1.5 h-1"}`}
          role="progressbar"
          aria-label={statusLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, rgba(${rgb},0.6), ${color})`,
              boxShadow: `0 0 10px ${color}`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
