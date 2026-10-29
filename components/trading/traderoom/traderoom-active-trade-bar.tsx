"use client"

import { useState } from "react"
import { Timer } from "lucide-react"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import { fmtBRL, fmtSigned, liveTradeState, type LiveTradeInput } from "@/lib/trading/live-pnl"
import { formatMMSS, useNow } from "./use-now"

export type OpenPosition = LiveTradeInput & { id: string; symbol: string }

type Props = {
  symbol: string
  positions: OpenPosition[]
  payout: number
  onSell: (ids: string[]) => Promise<void> | void
}

export function TraderoomActiveTradeBar({ symbol, positions, payout, onSell }: Props) {
  const now = useNow(250, positions.length > 0)
  const [selling, setSelling] = useState(false)
  if (positions.length === 0) return null

  const price = multiAssetEngine.getCurrentPrice(symbol)
  let invested = 0
  let expected = 0
  let afterSale = 0
  let remaining = Number.POSITIVE_INFINITY
  for (const p of positions) {
    const s = liveTradeState(p, price, payout, now)
    invested += p.amount
    expected += p.amount * (payout / 100)
    afterSale += s.sellPnl
    remaining = Math.min(remaining, s.remainingMs)
  }

  const handleSell = async () => {
    if (selling) return
    setSelling(true)
    try {
      await onSell(positions.map((p) => p.id))
    } finally {
      setSelling(false)
    }
  }

  return (
    <div className="absolute right-24 top-3 z-30 hidden lg:flex items-start gap-8 text-tr-fg">
      <Metric
        value={
          <span className="flex items-center gap-1">
            <Timer className="w-4 h-4" aria-hidden="true" />
            {formatMMSS(remaining / 1000)}
          </span>
        }
        label="Hora de compra"
      />
      <Metric value={`R$ ${fmtBRL(invested)}`} label="Investimento total" muted />
      <Metric value={fmtSigned(expected)} label="Lucro esperado" valueClass="text-tr-up" />
      <Metric
        value={fmtSigned(afterSale)}
        label={"Lucro após a venda (L/P)"}
        valueClass={afterSale >= 0 ? "text-tr-up" : "text-tr-down"}
      />
      <button
        type="button"
        onClick={handleSell}
        disabled={selling}
        className="h-8 min-w-28 bg-tr-raised px-6 text-sm text-tr-fg transition-colors hover:bg-tr-line disabled:opacity-60"
      >
        {selling ? "Vendendo..." : "Vender"}
      </button>
    </div>
  )
}

function Metric({
  value,
  label,
  valueClass = "",
  muted = false,
}: {
  value: React.ReactNode
  label: string
  valueClass?: string
  muted?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`text-xl leading-none tabular-nums ${muted ? "text-tr-muted" : valueClass}`}>{value}</span>
      <span className={`max-w-28 text-[10px] uppercase leading-tight ${muted ? "text-tr-muted" : "text-tr-fg"}`}>
        {label}
      </span>
    </div>
  )
}
