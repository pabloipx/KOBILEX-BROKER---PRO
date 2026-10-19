"use client"

import { useEffect, useMemo, useState } from "react"

export type CronosLook = { x: number; y: number }

const RING_TEXT = "RSI • MACD • EMA • VOL • SCAN • SUP/RES • FIBO • TREND • CANDLE • "

export function CronosEyeStyles() {
  return (
    <style>{`
      @keyframes cronos-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035); } }
      @keyframes cronos-halo { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
      @keyframes cronos-pupil { 0%,100% { transform: translate(-50%,-50%) scale(1); } 45% { transform: translate(-50%,-50%) scale(.78); } 60% { transform: translate(-50%,-50%) scale(1.12); } }
      @keyframes cronos-sweep { to { transform: rotate(360deg); } }
      @keyframes cronos-wander {
        0%, 8% { transform: translate(0,0) scale(1,1); }
        14%, 26% { transform: translate(-40%,-6%) scale(.82,.96); }
        32%, 44% { transform: translate(38%,10%) scale(.84,.95); }
        50%, 60% { transform: translate(0,-22%) scale(.97,.85); }
        66%, 78% { transform: translate(-30%,16%) scale(.86,.9); }
        84%, 100% { transform: translate(0,0) scale(1,1); }
      }
      @keyframes cronos-rain { from { transform: translateY(-60%); } to { transform: translateY(110%); } }
      @keyframes cronos-flicker { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
      @keyframes cronos-scanline { 0% { top: 6%; opacity: 0; } 10% { opacity: .9; } 90% { opacity: .9; } 100% { top: 94%; opacity: 0; } }
      @media (prefers-reduced-motion: reduce) {
        .cronos-anim, .cronos-anim * { animation: none !important; transition: none !important; }
      }
    `}</style>
  )
}

interface CronosEyeProps {
  look?: CronosLook
  scanning?: boolean
  showRings?: boolean
  className?: string
}

export function CronosEye({ look, scanning = false, showRings = true, className = "" }: CronosEyeProps) {
  const sphereInset = showRings ? "17%" : "3%"
  const irisTransform = look
    ? `translate(${look.x * 40}%, ${look.y * 26}%) scale(${1 - Math.abs(look.x) * 0.17}, ${1 - Math.abs(look.y) * 0.14})`
    : undefined

  return (
    <div className={`cronos-anim relative ${className}`} aria-hidden="true">
      <div
        className="absolute rounded-full"
        style={{
          inset: showRings ? "4%" : "-12%",
          background: "radial-gradient(circle, rgba(250,204,21,0.45) 0%, rgba(217,119,6,0.18) 45%, transparent 70%)",
          animation: `cronos-halo ${scanning ? 1.6 : 3.2}s ease-in-out infinite`,
        }}
      />

      {showRings && <CronosRings side="back" />}

      <div
        className="absolute rounded-full overflow-hidden"
        style={{
          inset: sphereInset,
          background:
            "radial-gradient(circle at 34% 28%, #fff8d6 0%, #fde68a 10%, #f5c542 28%, #c98a12 58%, #7a4a06 82%, #3a2203 100%)",
          boxShadow:
            "inset -10px -14px 28px rgba(40,22,0,0.75), inset 6px 8px 18px rgba(255,248,214,0.35), 0 0 34px rgba(250,204,21,0.55)",
          animation: `cronos-pulse ${scanning ? 1.4 : 2.8}s ease-in-out infinite`,
        }}
      >
        <span className="absolute rounded-full bg-white/80 blur-[3px]" style={{ left: "24%", top: "16%", width: "14%", height: "9%" }} />
        <span className="absolute rounded-full bg-white/45 blur-[4px]" style={{ left: "58%", top: "20%", width: "10%", height: "8%" }} />
        <span className="absolute rounded-full bg-white/25 blur-[6px]" style={{ left: "66%", top: "62%", width: "12%", height: "10%" }} />

        <div
          className="absolute"
          style={{
            left: "27%",
            top: "27%",
            width: "46%",
            height: "46%",
            transform: irisTransform,
            transition: look ? "transform 900ms cubic-bezier(.65,0,.25,1)" : undefined,
            animation: look ? undefined : `cronos-wander ${scanning ? 4.5 : 11}s ease-in-out infinite`,
          }}
        >
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              background:
                "radial-gradient(circle, transparent 38%, rgba(90,60,10,0.35) 40%, transparent 46%, transparent 88%, rgba(90,60,10,0.45) 100%), radial-gradient(circle, rgba(255,214,102,0.9) 30%, rgba(180,110,10,0.15) 70%), repeating-conic-gradient(from 0deg, #ffe08a 0deg 2.2deg, #a8650a 2.2deg 4.6deg)",
              boxShadow: "0 0 0 2px #ffd966, 0 0 16px rgba(255,200,60,0.9), inset 0 0 10px rgba(80,40,0,0.6)",
            }}
          >
            {scanning && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.75) 24deg, transparent 60deg)",
                  animation: "cronos-sweep 1.8s linear infinite",
                  mixBlendMode: "overlay",
                }}
              />
            )}
            <div
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: "44%",
                height: "44%",
                background: "radial-gradient(circle at 40% 38%, #3d2a08 0%, #120b02 45%, #000 100%)",
                boxShadow: "0 0 8px rgba(0,0,0,0.8)",
                animation: `cronos-pupil ${scanning ? 2.2 : 4.4}s ease-in-out infinite`,
              }}
            >
              <span className="absolute rounded-full bg-white/90" style={{ left: "22%", top: "20%", width: "22%", height: "22%" }} />
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle at 70% 78%, rgba(30,15,0,0.45) 0%, transparent 55%)" }}
        />
      </div>

      {showRings && <CronosRings side="front" />}
    </div>
  )
}

function CronosRings({ side }: { side: "back" | "front" }) {
  const front = side === "front"
  return (
    <svg
      viewBox="0 0 200 100"
      className="absolute pointer-events-none"
      style={{
        left: "-42%",
        width: "184%",
        top: "22%",
        height: "56%",
        transform: "rotate(-9deg)",
        clipPath: front ? "inset(50% 0 0 0)" : undefined,
        overflow: "visible",
      }}
    >
      <defs>
        <path id={`cronos-ring-${side}`} d="M 8,50 a 92,24 0 1,0 184,0 a 92,24 0 1,0 -184,0" />
      </defs>
      <ellipse cx="100" cy="50" rx="92" ry="24" fill="none" stroke="#fde68a" strokeOpacity={front ? 0.85 : 0.5} strokeWidth="0.8" />
      <ellipse
        cx="100"
        cy="50"
        rx="99"
        ry="33"
        fill="none"
        stroke="#facc15"
        strokeOpacity={front ? 0.55 : 0.3}
        strokeWidth="0.6"
        transform="rotate(7 100 50)"
      />
      <text fill="#fde68a" fillOpacity={front ? 0.9 : 0.45} fontSize="5" fontFamily="monospace" letterSpacing="0.6">
        <textPath href={`#cronos-ring-${side}`}>{RING_TEXT + RING_TEXT}</textPath>
      </text>
      <circle r="2" fill="#fff6c8" style={{ filter: "drop-shadow(0 0 3px #facc15)" }}>
        <animateMotion dur="6s" repeatCount="indefinite">
          <mpath href={`#cronos-ring-${side}`} />
        </animateMotion>
      </circle>
      <circle r="1.4" fill="#facc15">
        <animateMotion dur="9s" begin="-4s" repeatCount="indefinite">
          <mpath href={`#cronos-ring-${side}`} />
        </animateMotion>
      </circle>
    </svg>
  )
}

function CronosMatrix() {
  const columns = useMemo(() => {
    const chars = "0123456789ABCDEF$%#"
    let seed = 7
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    return Array.from({ length: 12 }, (_, i) => ({
      left: `${(i / 12) * 100 + 2}%`,
      text: Array.from({ length: 16 }, () => chars[Math.floor(rand() * chars.length)]).join("\n"),
      duration: 5 + rand() * 6,
      delay: -rand() * 10,
      opacity: 0.18 + rand() * 0.3,
    }))
  }, [])

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ maskImage: "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)" }}
    >
      {columns.map((c, i) => (
        <pre
          key={i}
          className="absolute top-0 m-0 font-mono text-[9px] leading-[11px] text-[#facc15]"
          style={{ left: c.left, opacity: c.opacity, animation: `cronos-rain ${c.duration}s linear ${c.delay}s infinite` }}
        >
          {c.text}
        </pre>
      ))}
    </div>
  )
}

const PHASES: { text: string; label: string; look: CronosLook }[] = [
  { text: "Escaneando o gráfico", label: "SCAN", look: { x: 0, y: 0 } },
  { text: "Mapeando suportes e resistências", label: "SUP / RES", look: { x: -1, y: -0.2 } },
  { text: "Lendo a força do RSI", label: "RSI", look: { x: 1, y: -0.3 } },
  { text: "Cruzando médias móveis", label: "EMA 9/21", look: { x: -0.85, y: 0.45 } },
  { text: "Medindo o volume", label: "VOLUME", look: { x: 0.9, y: 0.4 } },
  { text: "Traçando Fibonacci", label: "FIBO", look: { x: -1, y: 0.05 } },
  { text: "Lendo padrões de candles", label: "CANDLES", look: { x: 1, y: 0 } },
  { text: "Calculando o tempo certo", label: "TIMING", look: { x: 0, y: -0.15 } },
]

interface CronosStageProps {
  analyzing: boolean
  startedAt: number | null
  durationMs: number
  assetName?: string
}

export function CronosStage({ analyzing, startedAt, durationMs, assetName }: CronosStageProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!analyzing) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [analyzing])

  const elapsed = analyzing && startedAt ? Math.min(durationMs, Math.max(0, now - startedAt)) : 0
  const progress = analyzing ? elapsed / durationMs : 0
  const phaseMs = durationMs / PHASES.length
  const phaseIndex = Math.min(PHASES.length - 1, Math.floor(elapsed / phaseMs))
  const phase = PHASES[phaseIndex]
  const isSaccade = Math.floor(elapsed / (phaseMs / 2)) % 2 === 1
  const look: CronosLook | undefined = analyzing
    ? isSaccade
      ? { x: phase.look.x * 0.55 + (phase.look.x === 0 ? 0.35 : 0), y: phase.look.y * 0.5 - 0.15 }
      : phase.look
    : undefined
  const beamSide = analyzing && !isSaccade && phase.look.x !== 0 ? (phase.look.x < 0 ? "left" : "right") : null
  const secondsLeft = Math.ceil((durationMs - elapsed) / 1000)

  return (
    <div
      className="cronos-anim relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: "rgba(250,204,21,0.22)",
        background: "radial-gradient(ellipse at 50% 45%, rgba(120,80,8,0.35) 0%, #0a0805 60%, #050403 100%)",
      }}
    >
      <CronosEyeStyles />
      <CronosMatrix />

      <div className="relative h-[220px]">
        {(["left", "right"] as const).map((side) => (
          <div
            key={side}
            className="absolute top-1/2 pointer-events-none"
            style={{
              [side === "left" ? "right" : "left"]: "50%",
              width: "46%",
              height: 84,
              transform: "translateY(-50%)",
              opacity: beamSide === side ? 1 : 0,
              transition: "opacity 400ms ease",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                clipPath:
                  side === "left"
                    ? "polygon(0 0, 100% 46%, 100% 54%, 0 100%)"
                    : "polygon(0 46%, 100% 0, 100% 100%, 0 54%)",
                background:
                  side === "left"
                    ? "linear-gradient(to left, rgba(250,204,21,0.05), rgba(253,230,138,0.4))"
                    : "linear-gradient(to right, rgba(250,204,21,0.05), rgba(253,230,138,0.4))",
                animation: "cronos-flicker 0.9s ease-in-out infinite",
              }}
            />
            <span
              className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-[#fff3c4]"
              style={{
                [side === "left" ? "left" : "right"]: 4,
                borderColor: "rgba(253,230,138,0.6)",
                backgroundColor: "rgba(60,40,4,0.75)",
                boxShadow: "0 0 14px rgba(250,204,21,0.35)",
              }}
            >
              {phase.label}
            </span>
          </div>
        ))}

        <div className="absolute left-1/2 top-1/2 h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2">
          <CronosEye look={look} scanning={analyzing} className="h-full w-full" />
        </div>

        {analyzing && (
          <div
            className="absolute inset-x-6 h-px pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, #fde68a, transparent)",
              boxShadow: "0 0 10px #facc15",
              animation: "cronos-scanline 2.75s ease-in-out infinite",
            }}
          />
        )}
      </div>

      <div className="relative border-t px-4 py-3" style={{ borderColor: "rgba(250,204,21,0.15)", backgroundColor: "rgba(5,4,3,0.7)" }}>
        {analyzing ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-[#fde68a]" aria-live="polite">
                {phase.text}...
              </p>
              <span className="shrink-0 font-mono text-xs font-bold text-white/70">{secondsLeft}s</span>
            </div>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label="Progresso da análise"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg, #d97706, #facc15, #fff3c4)",
                  boxShadow: "0 0 10px #facc15",
                  transition: "width 100ms linear",
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex gap-1">
                {PHASES.map((p, i) => (
                  <span
                    key={p.label}
                    className="h-1 w-4 rounded-full"
                    style={{ backgroundColor: i <= phaseIndex ? "#facc15" : "rgba(255,255,255,0.12)" }}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] font-bold text-[#facc15]">{Math.round(progress * 100)}%</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#fde68a]">O olho está observando</p>
            <span className="truncate font-mono text-xs text-white/60">{assetName || "—"}</span>
          </div>
        )}
      </div>
    </div>
  )
}
