"use client"

import Image from "next/image"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import { fmtSigned, liveTradeState } from "@/lib/trading/live-pnl"
import { useNow } from "./use-now"
import type { OpenPosition } from "./traderoom-active-trade-bar"

type Props = {
  name: string
  logo: string
  isOtc: boolean
  positions: OpenPosition[]
  payout: number
}

const RING = 2 * Math.PI * 14

/** Logo + nome da aba; com operacao aberta vira anel regressivo + resultado ao vivo (IQ Option). */
export function TraderoomTabStatus({ name, logo, isOtc, positions, payout }: Props) {
  if (positions.length === 0) {
    return (
      <>
        <span className="w-6 h-6 rounded-full overflow-hidden bg-tr-line shrink-0">
          <Image src={logo || "/placeholder.svg"} alt="" width={24} height={24} className="w-full h-full object-cover" />
        </span>
        <span className="text-left min-w-0">
          <span className="block text-tr-fg font-semibold text-xs leading-tight truncate max-w-[84px]">{name}</span>
          <span className="block text-tr-muted text-[10px] leading-tight">{isOtc ? "Digital" : "Binária"}</span>
        </span>
      </>
    )
  }
  return <LiveStatus name={name} positions={positions} payout={payout} />
}

function LiveStatus({ name, positions, payout }: { name: string; positions: OpenPosition[]; payout: number }) {
  const now = useNow(500)
  const price = multiAssetEngine.getCurrentPrice(positions[0].symbol)
  let pnl = 0
  let nearest = positions[0]
  let nearestRemaining = Number.POSITIVE_INFINITY
  for (const p of positions) {
    const s = liveTradeState(p, price, payout, now)
    pnl += s.inMoney ? s.expectedPnl : -p.amount
    if (s.remainingMs < nearestRemaining) {
      nearestRemaining = s.remainingMs
      nearest = p
    }
  }
  const secs = Math.ceil(nearestRemaining / 1000)
  const fraction = Math.min(1, nearestRemaining / Math.max(1, nearest.expiryTime * 1000))

  return (
    <>
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
          <circle cx="16" cy="16" r="14" fill="none" className="stroke-tr-line" strokeWidth="2" />
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            className={secs <= 10 ? "stroke-tr-down" : "stroke-tr-fg"}
            strokeWidth="2"
            strokeDasharray={`${fraction * RING} ${RING}`}
          />
        </svg>
        <span className="text-[10px] font-semibold tabular-nums text-tr-fg">
          {secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : `:${String(secs).padStart(2, "0")}`}
        </span>
      </span>
      <span className="text-left min-w-0">
        <span className="block text-tr-fg font-semibold text-xs leading-tight truncate max-w-[84px]">{name}</span>
        <span className={`block text-[11px] font-semibold leading-tight tabular-nums ${pnl >= 0 ? "text-tr-up" : "text-tr-down"}`}>
          {fmtSigned(pnl)}
        </span>
      </span>
    </>
  )
}
