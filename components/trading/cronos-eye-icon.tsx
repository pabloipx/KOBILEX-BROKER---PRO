"use client"

import { useId } from "react"
import { CronosEye } from "@/components/trading/cronos-eye"

const CX = 110
const CY = 70
const OUTER = { rx: 106, ry: 40 }
const INNER = { rx: 92, ry: 29 }

function ellipsePath(rx: number, ry: number) {
  return `M ${CX - rx},${CY} a ${rx},${ry} 0 1,0 ${rx * 2},0 a ${rx},${ry} 0 1,0 ${-rx * 2},0`
}

const LEFT_TICKS = [34, 40, 45, 51, 56, 62, 67, 72]
const RIGHT_TICKS = [148, 153, 158, 164, 169, 175, 180, 186]

const SPARKS = [
  { ring: "outer", dur: 7, begin: 0, r: 2.6 },
  { ring: "outer", dur: 7, begin: -3.5, r: 2 },
  { ring: "inner", dur: 5, begin: -1.2, r: 2.2 },
  { ring: "inner", dur: 5, begin: -3.7, r: 1.6 },
] as const

const FLARES = [
  { x: CX - OUTER.rx, y: CY, r: 3.2, delay: 0 },
  { x: CX + OUTER.rx, y: CY, r: 3.2, delay: -0.8 },
  { x: CX, y: CY - OUTER.ry, r: 3.6, delay: -1.6 },
  { x: CX, y: CY + OUTER.ry, r: 3, delay: -0.4 },
  { x: CX + 74, y: CY + 27, r: 2.4, delay: -1.1 },
]

interface CronosEyeIconProps {
  analyzing?: boolean
  className?: string
}

export function CronosEyeIcon({ analyzing = false, className = "" }: CronosEyeIconProps) {
  const uid = useId().replace(/:/g, "")
  const glowId = `cei-glow-${uid}`
  const lensId = `cei-lens-${uid}`
  const outerId = `cei-outer-${uid}`
  const innerId = `cei-inner-${uid}`
  const speed = analyzing ? 0.45 : 1

  const ringLayer = (front: boolean) => (
    <svg
      viewBox="0 0 220 140"
      className="absolute inset-0 h-full w-full overflow-visible pointer-events-none"
      style={{
        clipPath: front ? "inset(50% -10% -10% -10%)" : undefined,
        animation: `cei-sway ${analyzing ? 2.4 : 6}s ease-in-out infinite`,
        transformOrigin: "50% 50%",
      }}
    >
      <ellipse
        cx={CX}
        cy={CY}
        rx={OUTER.rx}
        ry={OUTER.ry}
        fill="none"
        stroke="#fcd34d"
        strokeWidth={front ? 1.8 : 1.4}
        strokeOpacity={front ? 0.95 : 0.6}
        filter={`url(#${glowId})`}
      />
      <ellipse
        cx={CX}
        cy={CY}
        rx={INNER.rx}
        ry={INNER.ry}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={1.2}
        strokeOpacity={front ? 0.85 : 0.45}
        transform={`rotate(-4 ${CX} ${CY})`}
      />
      {SPARKS.map((s, i) => (
        <circle key={i} r={s.r} fill="#fffbe6" filter={`url(#${glowId})`}>
          <animateMotion dur={`${s.dur * speed}s`} begin={`${s.begin * speed}s`} repeatCount="indefinite">
            <mpath href={`#${s.ring === "outer" ? outerId : innerId}`} />
          </animateMotion>
        </circle>
      ))}
    </svg>
  )

  return (
    <div className={`cronos-anim relative ${className}`} aria-hidden="true">
      <style>{`
        @keyframes cei-sway { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes cei-tick { 0%,100% { transform: scaleY(.35); opacity: .45; } 50% { transform: scaleY(1); opacity: 1; } }
        @keyframes cei-flare { 0%,100% { opacity: .35; transform: scale(.7); } 50% { opacity: 1; transform: scale(1.25); } }
        @keyframes cei-lens { 0%,100% { opacity: .75; } 50% { opacity: 1; } }
        @keyframes cei-badge { 0%,100% { opacity: .65; } 50% { opacity: 1; } }
      `}</style>

      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: "-6% 8%",
          background: "radial-gradient(ellipse, rgba(250,204,21,0.38) 0%, rgba(217,119,6,0.14) 45%, transparent 70%)",
        }}
      />

      <svg viewBox="0 0 220 140" className="absolute inset-0 h-full w-full overflow-visible pointer-events-none">
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={lensId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#b45309" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
          </radialGradient>
          <path id={outerId} d={ellipsePath(OUTER.rx, OUTER.ry)} />
          <path id={innerId} d={ellipsePath(INNER.rx, INNER.ry)} />
        </defs>
        <path
          d={`M ${CX - 86},${CY} Q ${CX},${CY - 30} ${CX + 86},${CY} Q ${CX},${CY + 30} ${CX - 86},${CY} Z`}
          fill={`url(#${lensId})`}
          style={{ animation: `cei-lens ${analyzing ? 0.9 : 2.6}s ease-in-out infinite` }}
        />
        {[...LEFT_TICKS, ...RIGHT_TICKS].map((x, i) => (
          <rect
            key={x}
            x={x}
            y={CY - 5}
            width={i % 3 === 0 ? 2.6 : 1.6}
            height={10}
            rx={0.6}
            fill="#fde68a"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `cei-tick ${(analyzing ? 0.5 : 1.6) + (i % 4) * 0.12}s ease-in-out ${-(i % 5) * 0.21}s infinite`,
            }}
          />
        ))}
      </svg>

      {ringLayer(false)}

      <div className="absolute left-1/2 top-1/2 h-[82%] aspect-square -translate-x-1/2 -translate-y-1/2">
        <CronosEye showRings={false} scanning={analyzing} className="h-full w-full" />
      </div>

      {ringLayer(true)}

      <svg viewBox="0 0 220 140" className="absolute inset-0 h-full w-full overflow-visible pointer-events-none">
        {FLARES.map((f, i) => (
          <circle
            key={i}
            cx={f.x}
            cy={f.y}
            r={f.r}
            fill="#fffbe6"
            filter={`url(#${glowId})`}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `cei-flare ${analyzing ? 0.8 : 2.2}s ease-in-out ${f.delay}s infinite`,
            }}
          />
        ))}
      </svg>

      {analyzing && (
        <span
          className="absolute left-1/2 -top-3 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-[#fff3c4]"
          style={{
            borderColor: "rgba(253,230,138,0.6)",
            backgroundColor: "rgba(40,26,2,0.85)",
            boxShadow: "0 0 12px rgba(250,204,21,0.45)",
            animation: "cei-badge 1s ease-in-out infinite",
          }}
        >
          ANALISANDO
        </span>
      )}
    </div>
  )
}
