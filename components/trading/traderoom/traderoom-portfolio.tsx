"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Plus, ArrowUp, ArrowDown, X, HelpCircle, Settings } from "lucide-react"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import { fmtBRL, fmtSigned, liveTradeState } from "@/lib/trading/live-pnl"
import { formatMMSS, useNow } from "./use-now"
import type { OpenPosition } from "./traderoom-active-trade-bar"

type Props = {
  open: boolean
  onToggle: () => void
  positions: OpenPosition[]
  payout: number
  nameFor: (symbol: string) => string
  onSelectAsset: () => void
  onSell: (ids: string[]) => Promise<void> | void
}

export function TraderoomPortfolio({ open, onToggle, positions, payout, nameFor, onSelectAsset, onSell }: Props) {
  const now = useNow(500)
  const [selling, setSelling] = useState<string | null>(null)

  const rows = positions.map((p) => ({
    p,
    s: liveTradeState(p, multiAssetEngine.getCurrentPrice(p.symbol), payout, now),
  }))
  const totalAfterSale = rows.reduce((sum, r) => sum + r.s.sellPnl, 0)

  const sell = async (id: string) => {
    if (selling) return
    setSelling(id)
    try {
      await onSell([id])
    } finally {
      setSelling(null)
    }
  }

  return (
    <section
      aria-label="Portfólio total"
      className={`hidden lg:flex shrink-0 flex-col border-t-4 border-tr-line bg-tr-panel ${open && positions.length === 0 ? "h-[26vh] min-h-[170px] max-h-[232px]" : ""}`}
    >
      <div className="flex items-center justify-between bg-tr-raised/60 px-6 py-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-tr-fg">
          {positions.length > 0 ? (
            <>
              Opções ({positions.length})
              <span className={`font-normal tabular-nums ${totalAfterSale >= 0 ? "text-tr-up" : "text-tr-down"}`}>
                {fmtSigned(totalAfterSale)}
              </span>
            </>
          ) : (
            "Portfólio total"
          )}
        </h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-xs text-tr-muted hover:text-tr-fg transition-colors"
        >
          {open ? "Ocultar posições" : "Exibir posições"}
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {open &&
        (positions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <p className="text-sm text-tr-muted">Você ainda não tem nenhuma posição aberta</p>
            <button
              type="button"
              onClick={onSelectAsset}
              className="flex items-center gap-2 border border-tr-line px-4 py-1 text-sm text-tr-muted hover:text-tr-fg hover:border-tr-muted transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Selecione o ativo
            </button>
          </div>
        ) : (
          <ul className="max-h-[180px] overflow-y-auto">
            {rows.map(({ p, s }) => {
              const isCall = p.direction === "CALL"
              const pnlClass = s.sellPnl >= 0 ? "text-tr-up" : "text-tr-down"
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-5 border-t border-tr-line px-3 py-1.5 text-xs text-tr-muted"
                >
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <Settings className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="flex min-w-32 items-center gap-1.5 font-semibold text-tr-fg">
                    <span className={isCall ? "text-tr-up" : "text-tr-down"}>
                      {isCall ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                    </span>
                    {nameFor(p.symbol)}
                  </span>
                  <span>
                    Investimento <span className="text-tr-fg tabular-nums">R$ {fmtBRL(p.amount)}</span>
                  </span>
                  <span>
                    L/P esperados{" "}
                    <span className="text-tr-up tabular-nums">{fmtSigned(p.amount * (payout / 100))}</span>
                  </span>
                  <span>
                    Expira em <span className="text-tr-fg tabular-nums">{formatMMSS(s.remainingMs / 1000)}</span>
                  </span>
                  <span className="ml-auto">
                    L/P pós-venda{" "}
                    <span className={`tabular-nums ${pnlClass}`}>
                      {s.sellPct >= 0 ? "+" : "−"}
                      {Math.abs(s.sellPct).toFixed(2)}%
                    </span>{" "}
                    | <span className={`tabular-nums ${pnlClass}`}>{fmtSigned(s.sellPnl)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => sell(p.id)}
                    disabled={selling !== null}
                    aria-label={`Vender ${nameFor(p.symbol)}`}
                    title="Vender agora"
                    className="flex h-6 w-6 items-center justify-center text-tr-fg hover:text-tr-down disabled:opacity-40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        ))}
    </section>
  )
}
