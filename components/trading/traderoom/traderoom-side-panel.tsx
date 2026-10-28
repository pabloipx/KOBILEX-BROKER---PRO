"use client"

import Link from "next/link"
import { X, ChevronDown } from "lucide-react"
import { TradeHistorySidebar } from "@/components/trading/trade-history-sidebar"
import type { TraderoomPanel } from "./traderoom-nav"

const TITLES: Record<Exclude<TraderoomPanel, "portfolio">, string> = {
  history: "Histórico de trading",
  chat: "Chats e Suporte",
  tournaments: "Torneios",
  leaders: "Tabela de líderes",
  promo: "Promoção",
  tutorials: "Tutoriais",
  analysis: "Análise de mercado",
}

type Props = {
  panel: Exclude<TraderoomPanel, "portfolio">
  onClose: () => void
  userId: string
  historyRefresh: number
  isDemo: boolean
}

export function TraderoomSidePanel({ panel, onClose, userId, historyRefresh, isDemo }: Props) {
  return (
    <aside
      aria-label={TITLES[panel]}
      className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-tr-line bg-tr-rail min-h-0"
    >
      <div className={`flex items-center justify-between px-5 py-5 ${panel === "chat" ? "bg-tr-raised" : ""}`}>
        <h2 className="text-sm text-tr-fg">{TITLES[panel]}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel"
          className="text-tr-muted hover:text-tr-fg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {panel === "history" && (
        <>
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between rounded-sm bg-tr-raised px-4 py-2 text-sm text-tr-fg">
              <span>Todas as posições</span>
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden border-t border-tr-line">
            <TradeHistorySidebar userId={userId} refreshTrigger={historyRefresh} isDemo={isDemo} />
          </div>
        </>
      )}

      {panel === "chat" && (
        <Link
          href="/suporte"
          className="flex items-center gap-3 bg-tr-raised px-5 pb-5 hover:bg-tr-raised/80 transition-colors"
        >
          <span className="relative">
            <img
              src="/images/bullion-trader-logo.png"
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-tr-raised bg-tr-up" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm text-tr-brand">Suporte</span>
            <span className="text-xs text-tr-muted">Todo dia, a toda hora</span>
          </span>
        </Link>
      )}

      {panel === "tutorials" && (
        <div className="px-5 text-sm leading-relaxed text-tr-muted">
          <p>Aprenda a operar na Bullion Trader com nossos guias passo a passo.</p>
          <Link href="/help" className="mt-4 inline-block text-tr-brand hover:underline">
            Abrir central de ajuda
          </Link>
        </div>
      )}

      {(panel === "tournaments" || panel === "leaders" || panel === "promo" || panel === "analysis") && (
        <p className="px-5 text-sm leading-relaxed text-tr-muted">Em breve disponível na Bullion Trader.</p>
      )}
    </aside>
  )
}
