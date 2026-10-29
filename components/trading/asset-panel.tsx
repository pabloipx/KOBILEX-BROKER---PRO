"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  Search,
  Lock,
  Star,
  CircleCheck,
  Flame,
  Zap,
  CircleDollarSign,
  Landmark,
  Droplet,
  Bitcoin,
  PieChart,
  BarChart3,
  ChevronDown,
  Menu,
  Clock,
} from "lucide-react"
import { getMarketStatus } from "@/lib/market-hours"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import { timeframesFor, TIMEFRAME_LABELS } from "@/lib/trading/timeframes"
import { useWatchlist } from "@/lib/hooks/use-watchlist"

interface PanelAsset {
  symbol: string
  name: string
  category: string
  payout: number
  logo: string
  market?: "otc" | "open"
}

interface AssetPanelProps {
  open: boolean
  assets: PanelAsset[]
  selectedSymbol: string
  openTabs: string[]
  onSelect: (symbol: string) => void
  onClose: () => void
  /** Timestamp que muda periodicamente na pagina, para reavaliar horario de mercado. */
  clockTick: number
}

type SectionId =
  | "rush"
  | "trends"
  | "options"
  | "forex"
  | "crypto"
  | "stocks"
  | "commodities"
  | "funds"
  | "indices"
  | "watchlist"

const SECTIONS: { id: SectionId; label: string; icon: typeof Flame; isNew?: boolean }[] = [
  { id: "rush", label: "Trade Rush", icon: CircleCheck, isNew: true },
  { id: "trends", label: "Tendências", icon: Flame },
  { id: "options", label: "Opções", icon: Zap },
  { id: "forex", label: "Forex", icon: CircleDollarSign },
  { id: "crypto", label: "Cripto", icon: Bitcoin },
  { id: "stocks", label: "Ações", icon: Landmark },
  { id: "commodities", label: "Commodities", icon: Droplet },
  { id: "funds", label: "Fundos", icon: PieChart },
  { id: "indices", label: "Índices", icon: BarChart3 },
  { id: "watchlist", label: "Watchlist", icon: Star },
]

const TREND_MARKETS = [
  { id: "blitz", label: "Blitz" },
  { id: "binary", label: "Binária" },
  { id: "digital", label: "Digital" },
  { id: "forex", label: "Forex" },
  { id: "stocks", label: "Ações" },
  { id: "commodities", label: "Commodities" },
  { id: "funds", label: "Fundos" },
  { id: "indices", label: "Índices" },
] as const
type TrendMarket = (typeof TREND_MARKETS)[number]["id"]

const ASSET_FILTERS = [
  { id: "all", label: "Todos os ativos" },
  { id: "open", label: "Abertos agora" },
  { id: "otc", label: "Somente OTC" },
] as const
type AssetFilter = (typeof ASSET_FILTERS)[number]["id"]

function matchesSection(asset: PanelAsset, section: SectionId, watch: string[]) {
  switch (section) {
    case "options":
      return (asset.market || "otc") === "otc"
    case "forex":
    case "crypto":
    case "stocks":
    case "commodities":
    case "indices":
      return asset.category === section
    case "watchlist":
      return watch.includes(asset.symbol)
    default:
      return false
  }
}

function matchesTrendMarket(asset: PanelAsset, market: TrendMarket) {
  if (market === "blitz" || market === "digital") return (asset.market || "otc") === "otc"
  if (market === "binary") return true
  if (market === "funds") return false
  return asset.category === market
}

/** Variacao da vela de 5 minutos em curso, em %. */
function change5m(symbol: string): { price: number; change: number } {
  try {
    const price = multiAssetEngine.getCurrentPrice(symbol)
    const candles = multiAssetEngine.getCandles(symbol, 300)
    const last = candles?.[candles.length - 1]
    const base = last?.open || 0
    return { price, change: base > 0 && price > 0 ? ((price - base) / base) * 100 : 0 }
  } catch {
    return { price: 0, change: 0 }
  }
}

const fmtPrice = (v: number) => (v > 0 ? v.toFixed(v >= 100 ? 2 : 6) : "—")
const fmtChange = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`

function AssetPanelBase({ open, assets, selectedSymbol, openTabs, onSelect, onClose, clockTick }: AssetPanelProps) {
  const [search, setSearch] = useState("")
  const [section, setSection] = useState<SectionId>("trends")
  const [trendMarket, setTrendMarket] = useState<TrendMarket>("blitz")
  const [trendMenu, setTrendMenu] = useState(false)
  const [region, setRegion] = useState<"world" | "br">("world")
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all")
  const [expiryFilter, setExpiryFilter] = useState<number | "all">("all")
  const [openFilter, setOpenFilter] = useState<"asset" | "expiry" | null>(null)
  const [tick, setTick] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const { list: watch, has, toggle } = useWatchlist()

  useEffect(() => {
    if (!open) return
    setSearch("")
    setTrendMenu(false)
    setOpenFilter(null)
    const focus = setTimeout(() => searchRef.current?.focus(), 120)
    const refresh = setInterval(() => setTick((n) => n + 1), 2000)
    return () => {
      clearTimeout(focus)
      clearInterval(refresh)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const passesFilters = (a: PanelAsset) => {
    if (assetFilter === "open" && !getMarketStatus(a, new Date(clockTick)).open) return false
    if (assetFilter === "otc" && (a.market || "otc") !== "otc") return false
    if (expiryFilter !== "all" && !timeframesFor(a.symbol).includes(expiryFilter as never)) return false
    return true
  }

  const counts = useMemo(() => {
    const map: Partial<Record<SectionId, number>> = {}
    for (const s of SECTIONS) map[s.id] = assets.filter((a) => matchesSection(a, s.id, watch)).length
    return map
  }, [assets, watch])

  const listed = useMemo(() => {
    const term = search.trim().toLowerCase()
    const base = term
      ? assets.filter((a) => a.name.toLowerCase().includes(term) || a.symbol.toLowerCase().includes(term))
      : assets.filter((a) => matchesSection(a, section, watch))
    return base.filter(passesFilters).map((a) => ({ asset: a, ...change5m(a.symbol) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, search, section, watch, assetFilter, expiryFilter, clockTick, tick])

  const trends = useMemo(() => {
    const rows = assets
      .filter((a) => matchesTrendMarket(a, trendMarket) && passesFilters(a))
      .map((a) => ({ asset: a, ...change5m(a.symbol) }))
    const popular = [...rows].sort((a, b) =>
      region === "br" ? b.asset.payout - a.asset.payout : Math.abs(b.change) - Math.abs(a.change),
    )
    return {
      popular: popular.slice(0, 3),
      winners: [...rows].filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, 3),
      losers: [...rows].filter((r) => r.change < 0).sort((a, b) => a.change - b.change).slice(0, 3),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, trendMarket, region, assetFilter, expiryFilter, clockTick, tick])

  if (!open) return null

  const pick = (a: PanelAsset) => {
    if (!getMarketStatus(a, new Date(clockTick)).open) return
    onSelect(a.symbol)
    onClose()
  }

  const showTrends = !search && section === "trends"
  const showEmpty = !search && (section === "rush" || section === "funds")
  const sectionLabel = SECTIONS.find((s) => s.id === section)?.label

  return (
    <div className="hidden lg:block">
      <button
        type="button"
        aria-label="Fechar lista de ativos"
        onClick={onClose}
        className="fixed inset-0 top-[71px] z-40 cursor-default bg-tr-chart/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Selecionar ativo"
        className="fixed left-[88px] top-[71px] z-50 flex h-[min(700px,calc(100dvh-110px))] w-[min(800px,calc(100vw-110px))] gap-5 bg-tr-raised p-5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
      >
        {/* Categorias */}
        <nav aria-label="Categorias de ativos" className="flex w-[210px] shrink-0 flex-col overflow-y-auto">
          {SECTIONS.map((s) => {
            const active = !search && section === s.id
            const Icon = s.icon
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSearch("")
                  setSection(s.id)
                }}
                aria-current={active ? "true" : undefined}
                className={`flex items-center gap-4 px-3 py-3 text-left text-sm font-semibold text-tr-fg transition-colors ${
                  active ? "bg-tr-line/50" : "hover:bg-tr-line/30"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-tr-muted/80 text-tr-raised">
                  <Icon className="h-3 w-3" aria-hidden="true" strokeWidth={2.5} />
                </span>
                <span className="flex-1 border-b border-transparent">{s.label}</span>
                {s.isNew ? (
                  <span className="rounded-full bg-tr-brand px-1.5 py-0.5 text-[9px] font-bold uppercase text-tr-fg">New</span>
                ) : s.id !== "trends" ? (
                  <span className="min-w-5 rounded-full bg-tr-line px-1.5 py-0.5 text-center text-[10px] font-semibold text-tr-fg tabular-nums">
                    {counts[s.id] ?? 0}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <label className="relative block">
            <span className="sr-only">Pesquisar ativo</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tr-muted" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou ticker"
              className="w-full border border-tr-line bg-tr-panel py-2 pl-8 pr-3 text-sm text-tr-fg outline-none placeholder:text-tr-muted focus:border-tr-muted"
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {showEmpty && (
              <p className="flex h-full items-center justify-center px-10 text-center text-sm leading-relaxed text-tr-muted text-balance">
                {`Infelizmente, no momento não há ativos disponíveis em '${sectionLabel}'`}
              </p>
            )}

            {showTrends && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative w-[215px]">
                    <button
                      type="button"
                      onClick={() => setTrendMenu((v) => !v)}
                      aria-expanded={trendMenu}
                      className="flex w-full items-center justify-between bg-tr-panel px-3 py-2 text-sm text-tr-fg"
                    >
                      {TREND_MARKETS.find((m) => m.id === trendMarket)?.label}
                      <ChevronDown className={`h-4 w-4 transition-transform ${trendMenu ? "rotate-180" : ""}`} />
                    </button>
                    {trendMenu && (
                      <ul className="absolute left-0 right-0 top-full z-10 border border-tr-line bg-tr-panel shadow-xl">
                        {TREND_MARKETS.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setTrendMarket(m.id)
                                setTrendMenu(false)
                              }}
                              className={`w-full border-b border-tr-line/60 px-4 py-2 text-left text-sm transition-colors hover:bg-tr-line/40 ${
                                m.id === trendMarket ? "text-tr-fg" : "text-tr-fg/85"
                              }`}
                            >
                              {m.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex bg-tr-panel" role="group" aria-label="Região">
                    {(
                      [
                        { id: "world", label: "Mundialmente" },
                        { id: "br", label: "Brasil" },
                      ] as const
                    ).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRegion(r.id)}
                        aria-pressed={region === r.id}
                        className={`px-5 py-2 text-sm transition-colors ${
                          region === r.id ? "bg-tr-line text-tr-fg" : "text-tr-muted hover:text-tr-fg"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <TrendSection title="Mais negociados" rows={trends.popular} payoutOf={(a) => a.payout} onPick={pick} />
                <TrendSection title="Ganhadores" rows={trends.winners} payoutOf={(a) => a.payout} onPick={pick} />
                <TrendSection title="Perdedores" rows={trends.losers} payoutOf={(a) => a.payout} onPick={pick} />
              </div>
            )}

            {!showTrends && !showEmpty && (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-tr-raised text-left text-xs text-tr-muted">
                  <tr>
                    <th className="w-8 py-2 font-normal">
                      <span className="sr-only">Favorito</span>
                    </th>
                    <th className="py-2 font-normal">Nome</th>
                    <th className="py-2 text-right font-normal">Preço</th>
                    <th className="py-2 text-right font-normal">Mudança (5m)</th>
                    <th className="py-2 pr-2 text-right font-normal">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-tr-muted">
                        {search
                          ? `Nenhum ativo encontrado para "${search}".`
                          : section === "watchlist"
                            ? "Toque na estrela de um ativo para adicioná-lo à Watchlist."
                            : "Nenhum ativo disponível com estes filtros."}
                      </td>
                    </tr>
                  )}
                  {listed.map(({ asset, price, change }) => {
                    const status = getMarketStatus(asset, new Date(clockTick))
                    const closed = !status.open
                    const selected = asset.symbol === selectedSymbol
                    const fav = has(asset.symbol)
                    return (
                      <tr
                        key={asset.symbol}
                        onClick={() => pick(asset)}
                        aria-disabled={closed}
                        className={`border-t border-tr-line/60 transition-colors ${
                          closed ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-tr-line/30"
                        } ${selected ? "bg-tr-line/40" : ""}`}
                      >
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggle(asset.symbol)
                            }}
                            aria-pressed={fav}
                            aria-label={fav ? `Remover ${asset.name} da Watchlist` : `Adicionar ${asset.name} à Watchlist`}
                            className={fav ? "text-tr-warn" : "text-tr-muted hover:text-tr-fg"}
                          >
                            <Star className="h-4 w-4" fill={fav ? "currentColor" : "none"} />
                          </button>
                        </td>
                        <td className="py-2">
                          <span className="flex items-center gap-2.5">
                            <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-tr-line">
                              <Image src={asset.logo || "/placeholder.svg"} alt="" width={24} height={24} className="h-full w-full object-cover" />
                              {closed && (
                                <span className="absolute inset-0 flex items-center justify-center bg-tr-chart/60">
                                  <Lock className="h-3 w-3 text-tr-warn" />
                                </span>
                              )}
                            </span>
                            <span className="flex flex-col">
                              <span className="font-medium text-tr-fg">
                                {asset.name}
                                {openTabs.includes(asset.symbol) && <span className="sr-only"> (aberto em aba)</span>}
                              </span>
                              {closed && (
                                <span className="flex items-center gap-1 text-[11px] text-tr-warn">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  Mercado fechado
                                </span>
                              )}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 text-right text-tr-fg tabular-nums">{fmtPrice(price)}</td>
                        <td className={`py-2 text-right tabular-nums ${change >= 0 ? "text-tr-up" : "text-tr-down"}`}>
                          {fmtChange(change)}
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold text-tr-up tabular-nums">{asset.payout}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Filtros */}
          <div className="flex gap-5">
            <FilterSelect
              icon={<Menu className="h-4 w-4" aria-hidden="true" />}
              label={ASSET_FILTERS.find((f) => f.id === assetFilter)?.label || ""}
              open={openFilter === "asset"}
              onToggle={() => setOpenFilter((v) => (v === "asset" ? null : "asset"))}
              options={ASSET_FILTERS.map((f) => ({ key: f.id, label: f.label }))}
              onPick={(k) => {
                setAssetFilter(k as AssetFilter)
                setOpenFilter(null)
              }}
            />
            <FilterSelect
              icon={<Clock className="h-4 w-4" aria-hidden="true" />}
              label={expiryFilter === "all" ? "Todas as expirações" : `Expiração ${TIMEFRAME_LABELS[expiryFilter]}`}
              open={openFilter === "expiry"}
              onToggle={() => setOpenFilter((v) => (v === "expiry" ? null : "expiry"))}
              options={[
                { key: "all", label: "Todas as expirações" },
                ...[60, 300, 600, 900].map((s) => ({ key: String(s), label: `Expiração ${TIMEFRAME_LABELS[s]}` })),
              ]}
              onPick={(k) => {
                setExpiryFilter(k === "all" ? "all" : Number(k))
                setOpenFilter(null)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TrendSection({
  title,
  rows,
  payoutOf,
  onPick,
}: {
  title: string
  rows: { asset: PanelAsset; price: number; change: number }[]
  payoutOf: (a: PanelAsset) => number
  onPick: (a: PanelAsset) => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-2xl font-normal text-tr-fg">{title}</h3>
        <span className="text-xs text-tr-muted">Últimos 5 min</span>
      </div>
      {rows.length === 0 ? (
        <p className="bg-tr-panel/60 p-6 text-center text-sm text-tr-muted">Sem ativos nesta lista agora.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {rows.map(({ asset, price, change }) => (
            <button
              key={asset.symbol}
              type="button"
              onClick={() => onPick(asset)}
              className="flex flex-col gap-3 bg-tr-panel/70 p-3 text-left transition-colors hover:bg-tr-line/50"
            >
              <span className="flex items-center gap-2 text-sm text-tr-fg">
                <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-tr-line">
                  <Image src={asset.logo || "/placeholder.svg"} alt="" width={24} height={24} className="h-full w-full object-cover" />
                </span>
                <span className="truncate">{asset.name}</span>
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] text-tr-muted">Lucro</span>
                <span className="text-lg text-tr-up tabular-nums">{payoutOf(asset)}%</span>
              </span>
              <span className="grid grid-cols-2 gap-2 text-[11px]">
                <span className="flex flex-col">
                  <span className="text-tr-muted">Preço</span>
                  <span className="text-tr-fg tabular-nums">{fmtPrice(price)}</span>
                </span>
                <span className="flex flex-col">
                  <span className="text-tr-muted">Mudança (5m)</span>
                  <span className={`tabular-nums ${change >= 0 ? "text-tr-up" : "text-tr-down"}`}>{fmtChange(change)}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function FilterSelect({
  icon,
  label,
  open,
  onToggle,
  options,
  onPick,
}: {
  icon: React.ReactNode
  label: string
  open: boolean
  onToggle: () => void
  options: { key: string; label: string }[]
  onPick: (key: string) => void
}) {
  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 bg-tr-panel px-3 py-2 text-sm text-tr-fg"
      >
        <span className="text-tr-muted">{icon}</span>
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown className={`h-4 w-4 text-tr-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="absolute bottom-full left-0 right-0 z-10 mb-1 border border-tr-line bg-tr-panel shadow-xl">
          {options.map((o) => (
            <li key={o.key}>
              <button
                type="button"
                onClick={() => onPick(o.key)}
                className="w-full px-4 py-2 text-left text-sm text-tr-fg hover:bg-tr-line/40"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Memoizado para não re-renderizar a lista de ativos a cada tick de preço da tela de trade.
export const AssetPanel = memo(AssetPanelBase)
