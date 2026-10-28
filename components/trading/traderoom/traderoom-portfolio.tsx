"use client"

import { ChevronDown, ChevronUp, Plus, ArrowUp, ArrowDown } from "lucide-react"
import { formatMMSS, useNow } from "./use-now"

type Position = {
  id: string
  symbol: string
  direction: "CALL" | "PUT"
  amount: number
  expiryTime: number
  timestamp: number
}

type Props = {
  open: boolean
  onToggle: () => void
  positions: Position[]
  nameFor: (symbol: string) => string
  onSelectAsset: () => void
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Remaining({ expiresAt }: { expiresAt: number }) {
  const now = useNow(500)
  return <span className="tabular-nums">{formatMMSS((expiresAt - now) / 1000)}</span>
}

export function TraderoomPortfolio({ open, onToggle, positions, nameFor, onSelectAsset }: Props) {
  return (
    <section
      aria-label="Portfólio total"
      className={`hidden lg:flex shrink-0 flex-col border-t-4 border-tr-line bg-tr-panel ${open ? "h-[26vh] min-h-[170px] max-h-[232px]" : ""}`}
    >
      <div className="flex items-center justify-between bg-tr-raised/60 px-6 py-2">
        <h2 className="text-sm font-semibold text-tr-fg">Portfólio total</h2>
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
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-tr-muted">
                <tr>
                  <th className="px-6 py-2 font-normal">Ativo</th>
                  <th className="px-6 py-2 font-normal">Direção</th>
                  <th className="px-6 py-2 font-normal">Investimento</th>
                  <th className="px-6 py-2 font-normal">Expira em</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-t border-tr-line text-tr-fg">
                    <td className="px-6 py-2">{nameFor(p.symbol)}</td>
                    <td className="px-6 py-2">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          p.direction === "CALL" ? "text-tr-up" : "text-tr-down"
                        }`}
                      >
                        {p.direction === "CALL" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                        {p.direction === "CALL" ? "Acima" : "Abaixo"}
                      </span>
                    </td>
                    <td className="px-6 py-2 tabular-nums">R$ {fmt(p.amount)}</td>
                    <td className="px-6 py-2">
                      <Remaining expiresAt={p.timestamp + p.expiryTime * 1000} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  )
}
