"use client"

import { useCallback, useDeferredValue, useRef, useState } from "react"
import Link from "next/link"
import useSWR, { useSWRConfig } from "swr"
import { Headset, LayoutDashboard, LogOut, MessagesSquare, Users, Wifi, WifiOff } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { STAFF_TOPIC } from "@/lib/support/constants"
import { supportFetch, supportFetcher, useSupportSignal } from "@/lib/support/client"
import { cn } from "@/lib/utils"
import { ConversationFilters, ConversationList } from "./conversation-list"
import { ConversationPanel } from "./conversation-panel"
import { TeamDialog } from "./team-dialog"
import type { Agent, Filters, ListResponse, StaffInfo, Stats } from "./types"

const STAT_CARDS: { key: keyof Stats; label: string; accent: string }[] = [
  { key: "total", label: "Total", accent: "text-white" },
  { key: "new", label: "Novos", accent: "text-sky-300" },
  { key: "waiting_agent", label: "Aguardando atendente", accent: "text-amber-300" },
  { key: "in_progress", label: "Em atendimento", accent: "text-[#fdba74]" },
  { key: "waiting_customer", label: "Aguardando cliente", accent: "text-violet-300" },
  { key: "completed", label: "Concluídos", accent: "text-emerald-300" },
  { key: "unread", label: "Não lidas", accent: "text-[#f97316]" },
]

export function SupportDashboard({ staff }: { staff: StaffInfo }) {
  const [filters, setFilters] = useState<Filters>({ view: "active", q: "", category: "", status: "", from: "", to: "" })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [teamOpen, setTeamOpen] = useState(false)
  const [online, setOnline] = useState(true)
  const deferredQ = useDeferredValue(filters.q)

  const params = new URLSearchParams({ view: filters.view })
  if (deferredQ.trim()) params.set("q", deferredQ.trim())
  if (filters.category) params.set("category", filters.category)
  if (filters.view === "active" && filters.status) params.set("status", filters.status)
  if (filters.view === "completed" && filters.from) params.set("from", filters.from)
  if (filters.view === "completed" && filters.to) params.set("to", filters.to)

  const { data, isLoading, mutate, error } = useSWR<ListResponse>(
    `/api/support/staff/conversations?${params}`,
    supportFetcher,
    {
      refreshInterval: 20_000,
      keepPreviousData: true,
      onSuccess: () => setOnline(true),
      onError: (e) => {
        if ((e as { status?: number }).status === 401) window.location.reload()
        else setOnline(false)
      },
    },
  )
  const { data: agentsData, mutate: mutateAgents } = useSWR<{ agents: Agent[] }>(
    "/api/support/staff/agents",
    supportFetcher,
  )
  const agents = agentsData?.agents ?? []

  const refreshAll = useCallback(() => {
    mutate()
  }, [mutate])

  const { mutate: globalMutate } = useSWRConfig()
  const lastChime = useRef(0)
  useSupportSignal(STAFF_TOPIC, (event, payload) => {
    mutate()
    const id = typeof payload.conversationId === "string" ? payload.conversationId : null
    if (id) globalMutate(`/api/support/staff/conversations/${id}`)
    if (event === "message" && payload.senderRole === "customer" && Date.now() - lastChime.current > 4000) {
      lastChime.current = Date.now()
      if (typeof document !== "undefined" && document.hidden) {
        document.title = "(Nova mensagem) Central de Atendimento"
      }
    }
  })

  const updateFilters = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))
  const switchView = (view: Filters["view"]) => {
    setFilters((f) => ({ ...f, view, status: "" }))
    setSelectedId(null)
  }

  const logout = async () => {
    await supportFetch("/api/support/staff/logout", { method: "POST" }).catch(() => {})
    window.location.reload()
  }

  const stats = data?.stats

  return (
    <div
      className="flex h-dvh flex-col bg-[#0B0F14] text-white"
      onFocus={() => {
        if (document.title.startsWith("(Nova")) document.title = "Central de Atendimento"
      }}
    >
      <Toaster theme="dark" position="top-center" />
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f97316]/15">
          <Headset className="size-5 text-[#f97316]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">Central de Atendimento</h1>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-white/45">
            {online && !error ? (
              <Wifi className="size-3 text-emerald-400" aria-hidden />
            ) : (
              <WifiOff className="size-3 text-red-400" aria-hidden />
            )}
            {staff.name} · {staff.role === "admin" ? "Administrador" : "Atendente"}
          </p>
        </div>
        {staff.role === "admin" && (
          <>
            <button
              type="button"
              onClick={() => setTeamOpen(true)}
              aria-label="Gerenciar equipe"
              className="flex size-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"
            >
              <Users className="size-5" />
            </button>
            <Link
              href="/admin/dashboard"
              aria-label="Painel administrativo da corretora"
              className="flex size-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"
            >
              <LayoutDashboard className="size-5" />
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={logout}
          aria-label="Sair"
          className="flex size-11 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-5" />
        </button>
      </header>

      {!online && (
        <p role="status" className="bg-red-500/10 px-3 py-1.5 text-center text-xs text-red-300">
          Conexão instável. Tentando reconectar...
        </p>
      )}

      <div className={cn("border-b border-white/[0.06]", selectedId && "hidden lg:block")}>
        <ul className="flex snap-x gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none] lg:grid lg:grid-cols-7">
          {STAT_CARDS.map((s) => (
            <li
              key={s.key}
              className="flex min-w-[112px] shrink-0 snap-start flex-col gap-1 rounded-xl border border-white/[0.06] bg-[#11161f] p-3"
            >
              <span className={cn("text-xl font-bold tabular-nums", s.accent)}>{stats ? stats[s.key] : "—"}</span>
              <span className="text-[11px] leading-tight text-white/50">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "flex min-h-0 w-full flex-col border-white/[0.06] lg:w-[380px] lg:shrink-0 lg:border-r",
            selectedId && "hidden lg:flex",
          )}
        >
          <div role="tablist" className="flex gap-1 p-3 pb-0">
            {(
              [
                ["active", "Ativos"],
                ["completed", "Atendimentos concluídos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filters.view === value}
                onClick={() => switchView(value)}
                className={cn(
                  "h-10 flex-1 rounded-lg text-[13px] font-semibold transition-colors",
                  filters.view === value ? "bg-[#f97316] text-white" : "bg-white/[0.04] text-white/60 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <ConversationFilters filters={filters} onChange={updateFilters} />
          <ConversationList
            items={data?.items ?? []}
            loading={isLoading}
            selectedId={selectedId}
            view={filters.view}
            onSelect={setSelectedId}
          />
        </aside>

        <main className={cn("min-h-0 flex-1 flex-col", selectedId ? "flex" : "hidden lg:flex")}>
          {selectedId ? (
            <ConversationPanel
              key={selectedId}
              conversationId={selectedId}
              staff={staff}
              agents={agents}
              onBack={() => setSelectedId(null)}
              onChanged={refreshAll}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <MessagesSquare className="size-10 text-white/15" aria-hidden />
              <p className="text-sm text-white/45">Selecione um atendimento para ver a conversa.</p>
            </div>
          )}
        </main>
      </div>

      {staff.role === "admin" && (
        <TeamDialog
          open={teamOpen}
          onOpenChange={setTeamOpen}
          agents={agents}
          currentId={staff.id}
          onChanged={() => mutateAgents()}
        />
      )}
    </div>
  )
}
