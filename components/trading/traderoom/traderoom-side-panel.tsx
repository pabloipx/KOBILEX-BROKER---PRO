"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { X, ChevronDown, Settings, GripHorizontal, Trash2, BellRing, ChevronRight } from "lucide-react"
import { TradeHistorySidebar } from "@/components/trading/trade-history-sidebar"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import type { PriceAlert, TriggeredAlert } from "@/lib/hooks/use-price-alerts"
import { NAV_ITEMS, type NavItemId, type TraderoomPanel } from "./traderoom-nav"
import type { NavConfigEntry } from "./use-nav-config"

export type SidePanelId = Exclude<TraderoomPanel, "portfolio">

const TITLES: Record<SidePanelId, string> = {
  history: "Histórico de trading",
  chat: "Chats e Suporte",
  tournaments: "Torneios",
  leaders: "Tabela de líderes",
  promo: "Promoção",
  tutorials: "Tutoriais",
  analysis: "Análise de mercado",
  help: "Ajuda",
  alerts: "Alertas",
  more: "Exibir mais",
}

type Props = {
  panel: SidePanelId
  onClose: () => void
  onOpen: (id: NavItemId) => void
  userId: string
  historyRefresh: number
  isDemo: boolean
  navConfig: NavConfigEntry[]
  onToggleNavItem: (id: NavItemId) => void
  onMoveNavItem: (from: number, to: number) => void
  symbol: string
  symbolName: string
  alerts: PriceAlert[]
  triggeredAlerts: TriggeredAlert[]
  onAddAlert: (symbol: string, name: string, price: number) => boolean
  onRemoveAlert: (id: string) => void
  onClearTriggered: () => void
}

const fmtPrice = (v: number) => v.toFixed(v >= 100 ? 2 : v >= 1 ? 5 : 6)

function MenuSettings({
  config,
  onToggle,
  onMove,
}: {
  config: NavConfigEntry[]
  onToggle: (id: NavItemId) => void
  onMove: (from: number, to: number) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div className="absolute left-3 right-3 top-14 z-40 rounded-md border border-tr-line bg-tr-raised py-2 shadow-2xl">
      <p className="px-4 pb-2 pt-1 text-xs font-semibold uppercase text-tr-fg">Itens do menu esquerdo</p>
      <ul>
        {config.map((entry, i) => {
          const item = NAV_ITEMS[entry.id]
          const locked = entry.id === "portfolio"
          return (
            <li
              key={entry.id}
              draggable
              onDragStart={(e) => {
                setDragIndex(i)
                e.dataTransfer.effectAllowed = "move"
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (overIndex !== i) setOverIndex(i)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex != null) onMove(dragIndex, i)
                setDragIndex(null)
                setOverIndex(null)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              className={`flex items-center gap-3 border-t border-tr-line px-4 py-2 first:border-t-0 ${
                dragIndex === i ? "opacity-40" : ""
              } ${overIndex === i && dragIndex !== i ? "bg-tr-line/60" : ""}`}
            >
              <label className={`flex flex-1 items-center gap-3 text-sm ${locked ? "text-tr-muted" : "cursor-pointer text-tr-fg"}`}>
                <input
                  type="checkbox"
                  checked={entry.visible}
                  disabled={locked}
                  onChange={() => onToggle(entry.id)}
                  className="h-4 w-4 cursor-pointer accent-tr-brand disabled:cursor-not-allowed disabled:opacity-50"
                />
                {item.menuLabel}
              </label>
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onMove(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Mover ${item.menuLabel} para cima`}
                  className="sr-only focus:not-sr-only"
                >
                  Subir
                </button>
                <GripHorizontal className="w-4 h-4 cursor-grab text-tr-muted" aria-hidden="true" />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AlertsPanel({
  symbol,
  symbolName,
  alerts,
  triggered,
  onAdd,
  onRemove,
  onClearTriggered,
}: {
  symbol: string
  symbolName: string
  alerts: PriceAlert[]
  triggered: TriggeredAlert[]
  onAdd: Props["onAddAlert"]
  onRemove: Props["onRemoveAlert"]
  onClearTriggered: () => void
}) {
  const [value, setValue] = useState(() => {
    const p = multiAssetEngine.getCurrentPrice(symbol)
    return p > 0 ? fmtPrice(p) : ""
  })
  const [error, setError] = useState("")

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const price = Number(value.replace(",", "."))
    if (!onAdd(symbol, symbolName, price)) {
      setError("Informe um preço válido.")
      return
    }
    setError("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
      <form onSubmit={submit} className="flex flex-col gap-2 rounded-md bg-tr-raised p-3">
        <label htmlFor="alert-price" className="text-xs text-tr-muted">
          Avisar quando <span className="text-tr-fg">{symbolName}</span> chegar em
        </label>
        <div className="flex gap-2">
          <input
            id="alert-price"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-w-0 flex-1 rounded-sm border border-tr-line bg-tr-chart px-2 py-1.5 text-sm tabular-nums text-tr-fg outline-none focus:border-tr-brand"
          />
          <button
            type="submit"
            className="rounded-sm bg-tr-brand px-3 text-xs font-semibold text-tr-fg transition-opacity hover:opacity-90"
          >
            Criar
          </button>
        </div>
        {error && <p className="text-xs text-tr-down">{error}</p>}
      </form>

      <section aria-label="Alertas ativos" className="flex flex-col gap-1">
        <h3 className="text-[11px] uppercase tracking-wide text-tr-muted">Ativos ({alerts.length})</h3>
        {alerts.length === 0 ? (
          <p className="text-sm leading-relaxed text-tr-muted">Nenhum alerta ativo.</p>
        ) : (
          <ul className="flex flex-col">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 border-b border-tr-line py-2 text-sm">
                <span className="flex flex-col">
                  <span className="text-tr-fg">{a.name}</span>
                  <span className="text-xs tabular-nums text-tr-muted">
                    {a.direction === "above" ? "Acima de" : "Abaixo de"} {fmtPrice(a.price)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(a.id)}
                  aria-label={`Remover alerta de ${a.name}`}
                  className="text-tr-muted transition-colors hover:text-tr-down"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {triggered.length > 0 && (
        <section aria-label="Alertas disparados" className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] uppercase tracking-wide text-tr-muted">Disparados</h3>
            <button type="button" onClick={onClearTriggered} className="text-xs text-tr-muted hover:text-tr-fg">
              Limpar
            </button>
          </div>
          <ul className="flex flex-col">
            {triggered.map((a) => (
              <li key={a.id} className="flex items-center gap-2 border-b border-tr-line py-2 text-sm">
                <BellRing className="w-4 h-4 shrink-0 text-tr-brand" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-tr-fg">{a.name}</span>
                  <span className="text-xs tabular-nums text-tr-muted">
                    Atingiu {fmtPrice(a.hitPrice)} às{" "}
                    {new Date(a.triggeredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export function TraderoomSidePanel(props: Props) {
  const { panel, onClose, userId, historyRefresh, isDemo } = props
  const [showSettings, setShowSettings] = useState(false)
  const hiddenItems = props.navConfig.filter((e) => !e.visible)

  return (
    <aside
      aria-label={TITLES[panel]}
      className="relative hidden lg:flex w-[260px] shrink-0 flex-col border-r border-tr-line bg-tr-rail min-h-0"
    >
      <div className={`flex items-center justify-between px-5 py-5 ${panel === "chat" ? "bg-tr-raised" : ""}`}>
        <h2 className="text-sm text-tr-fg">{TITLES[panel]}</h2>
        <div className="flex items-center gap-3">
          {panel === "more" && (
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-label="Configurar itens do menu"
              aria-expanded={showSettings}
              className={`transition-colors ${showSettings ? "text-tr-fg" : "text-tr-muted hover:text-tr-fg"}`}
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="text-tr-muted hover:text-tr-fg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {panel === "more" && (
        <>
          {hiddenItems.length === 0 ? (
            <p className="px-5 text-sm leading-relaxed text-tr-muted">Todos os itens já estão no menu.</p>
          ) : (
            <ul className="flex flex-col">
              {hiddenItems.map(({ id }, i) => {
                const item = NAV_ITEMS[id]
                const Icon = item.icon
                return (
                  <li key={id} className={i > 0 ? "border-t border-tr-line" : ""}>
                    <button
                      type="button"
                      onClick={() => props.onOpen(id)}
                      className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-xs uppercase text-tr-fg transition-colors hover:bg-tr-raised"
                    >
                      <Icon className="w-6 h-6 text-tr-muted" strokeWidth={1.75} aria-hidden="true" />
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {showSettings && (
            <>
              <button
                type="button"
                aria-label="Fechar configurações"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setShowSettings(false)}
              />
              <MenuSettings config={props.navConfig} onToggle={props.onToggleNavItem} onMove={props.onMoveNavItem} />
            </>
          )}
        </>
      )}

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
            <img src="/images/bullion-trader-logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-tr-raised bg-tr-up" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm text-tr-brand">Suporte</span>
            <span className="text-xs text-tr-muted">Todo dia, a toda hora</span>
          </span>
        </Link>
      )}

      {panel === "help" && (
        <ul className="flex flex-col">
          {[
            { href: "/help", label: "Central de ajuda", desc: "Guias e perguntas frequentes" },
            { href: "/suporte", label: "Falar com o suporte", desc: "Todo dia, a toda hora" },
          ].map((l) => (
            <li key={l.href} className="border-t border-tr-line first:border-t-0">
              <Link href={l.href} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-tr-raised">
                <span className="flex flex-col">
                  <span className="text-sm text-tr-fg">{l.label}</span>
                  <span className="text-xs text-tr-muted">{l.desc}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-tr-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
          <li className="border-t border-tr-line">
            <button
              type="button"
              onClick={() => props.onOpen("tutorials")}
              className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-tr-raised"
            >
              <span className="flex flex-col">
                <span className="text-sm text-tr-fg">Como operar</span>
                <span className="text-xs text-tr-muted">Tutoriais da plataforma</span>
              </span>
              <ChevronRight className="w-4 h-4 text-tr-muted" aria-hidden="true" />
            </button>
          </li>
        </ul>
      )}

      {panel === "alerts" && (
        <AlertsPanel
          key={props.symbol}
          symbol={props.symbol}
          symbolName={props.symbolName}
          alerts={props.alerts}
          triggered={props.triggeredAlerts}
          onAdd={props.onAddAlert}
          onRemove={props.onRemoveAlert}
          onClearTriggered={props.onClearTriggered}
        />
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
