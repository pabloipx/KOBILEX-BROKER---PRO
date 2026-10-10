"use client"

import { Loader2, Search, UserRound } from "lucide-react"
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES, getCategory, getStatusLabel } from "@/lib/support/constants"
import { formatDateTime } from "@/lib/support/client"
import { cn } from "@/lib/utils"
import type { ConversationItem, Filters } from "./types"

export const STATUS_STYLES: Record<string, string> = {
  new: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  waiting_agent: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  in_progress: "bg-[#f97316]/15 text-[#fdba74] border-[#f97316]/30",
  waiting_customer: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status] ?? "border-white/10 text-white/60",
      )}
    >
      {getStatusLabel(status)}
    </span>
  )
}

const selectClass =
  "h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#11161f] px-3 text-base text-white outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] md:text-sm"

export function ConversationFilters({ filters, onChange }: { filters: Filters; onChange: (f: Partial<Filters>) => void }) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.06] p-3">
      <div className="relative">
        <label htmlFor="support-search" className="sr-only">
          Buscar atendimentos
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
        <input
          id="support-search"
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Nome, usuário, ID da conta ou nº"
          className="h-11 w-full rounded-lg border border-white/10 bg-[#11161f] pl-9 pr-3 text-base text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[#f97316] md:text-sm"
        />
      </div>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="support-category">
          Categoria
        </label>
        <select
          id="support-category"
          value={filters.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className={selectClass}
        >
          <option value="">Todas as categorias</option>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.short}
            </option>
          ))}
        </select>
        {filters.view === "active" && (
          <>
            <label className="sr-only" htmlFor="support-status">
              Status
            </label>
            <select
              id="support-status"
              value={filters.status}
              onChange={(e) => onChange({ status: e.target.value })}
              className={selectClass}
            >
              <option value="">Todos os status</option>
              {SUPPORT_STATUSES.filter((s) => s.key !== "completed").map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {filters.view === "completed" && (
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-white/45">
            Encerrado de
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ from: e.target.value })}
              className={cn(selectClass, "[color-scheme:dark]")}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-white/45">
            até
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ to: e.target.value })}
              className={cn(selectClass, "[color-scheme:dark]")}
            />
          </label>
        </div>
      )}
    </div>
  )
}

export function ConversationList({
  items,
  loading,
  selectedId,
  view,
  onSelect,
}: {
  items: ConversationItem[]
  loading: boolean
  selectedId: string | null
  view: Filters["view"]
  onSelect: (id: string) => void
}) {
  if (loading && items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-white/40" aria-label="Carregando" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <p className="flex-1 p-8 text-center text-sm text-white/45">
        {view === "completed" ? "Nenhum atendimento concluído encontrado." : "Nenhum atendimento ativo no momento."}
      </p>
    )
  }

  return (
    <ul className="flex-1 overflow-y-auto overscroll-contain" aria-label="Atendimentos">
      {items.map((c) => {
        const category = getCategory(c.category)
        const unread = c.unread_count > 0
        const name = c.customer_name || c.customer_username || "Cliente"
        return (
          <li key={c.id} className="border-b border-white/[0.05]">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={selectedId === c.id}
              className={cn(
                "flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors hover:bg-white/[0.03]",
                selectedId === c.id && "bg-[#f97316]/[0.08] hover:bg-[#f97316]/[0.1]",
                unread && "border-l-2 border-l-[#f97316]",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-bold text-white" : "font-semibold text-white/90")}>
                  {name}
                </span>
                <span className="shrink-0 text-[11px] text-white/40">
                  {formatDateTime(view === "completed" ? c.closed_at : c.last_message_at)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/45">
                <span>#{c.number}</span>
                {c.customer_username && <span>@{c.customer_username}</span>}
                {c.account_id && <span>Conta {c.account_id}</span>}
              </div>
              <div className="flex items-center gap-2">
                <p className={cn("min-w-0 flex-1 truncate text-[13px]", unread ? "text-white/85" : "text-white/50")}>
                  {c.last_message_preview || "Sem mensagens"}
                </p>
                {unread && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f97316] px-1.5 text-[11px] font-bold text-white">
                    {c.unread_count}
                    <span className="sr-only"> não lidas</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={c.status} />
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60">
                  {category ? category.short : "Sem categoria"}
                </span>
                {c.assigned_agent_name && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                    <UserRound className="size-3" aria-hidden />
                    {c.assigned_agent_name}
                  </span>
                )}
              </div>
              {view === "completed" && (
                <p className="text-[11px] text-white/35">
                  Aberto em {formatDateTime(c.created_at)}
                  {c.closed_by_name ? ` · Encerrado por ${c.closed_by_name}` : ""}
                </p>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
