"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react"

type Summary = {
  deposits: { total: number; count: number; pending: number; pendingCount: number }
  withdrawals: { total: number; count: number; pending: number; pendingCount: number }
  net: number
  avgDeposit: number
  newUsers: number
  convertedUsers: number
  conversionRate: number
}
type DailyRow = {
  date: string
  depositos: number
  depositosQtd: number
  saques: number
  saquesQtd: number
  liquido: number
  usuarios: number
}
type ReportData = { from: string; to: string; days: number; summary: Summary; daily: DailyRow[] }

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0)
const fmtMoneyShort = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0)
const fmtDayShort = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7)

function todayKey(offsetDays = 0) {
  const d = new Date(Date.now() - 3 * 3_600_000 + offsetDays * 86_400_000)
  return d.toISOString().slice(0, 10)
}

const PRESETS: { label: string; days: number }[] = [
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
]

function ReportCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Wallet
  label: string
  value: string
  sub?: string
  tone: "green" | "red" | "blue" | "orange"
}) {
  const tones = {
    green: "text-emerald-400 bg-emerald-500/10",
    red: "text-red-400 bg-red-500/10",
    blue: "text-sky-400 bg-sky-500/10",
    orange: "text-orange-400 bg-orange-500/10",
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c121c] p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c121c] p-5">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1019] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-gray-300">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === "usuarios" ? p.value : fmtMoney(p.value)}
        </p>
      ))}
    </div>
  )
}

export function AdminReports() {
  const [from, setFrom] = useState(() => todayKey(-29))
  const [to, setTo] = useState(() => todayKey(0))
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/reports?from=${from}&to=${to}`, { credentials: "include" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha ao carregar")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const applyPreset = (days: number) => {
    setFrom(todayKey(-(days - 1)))
    setTo(todayKey(0))
  }

  const exportCsv = async (kind: string) => {
    setExporting(kind)
    try {
      const res = await fetch(`/api/admin/reports?from=${from}&to=${to}&format=csv&kind=${kind}`, {
        credentials: "include",
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Falha na exportacao")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${kind}_${from}_a_${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na exportacao")
    } finally {
      setExporting(null)
    }
  }

  const s = data?.summary
  const chartData = useMemo(
    () => (data?.daily ?? []).map((d) => ({ ...d, dia: fmtDayShort(d.date) })),
    [data],
  )

  const exportButtons = [
    { kind: "daily", label: "Resumo diário" },
    { kind: "deposits", label: "Depósitos" },
    { kind: "withdrawals", label: "Saques" },
    { kind: "users", label: "Usuários" },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Relatórios financeiros</h1>
          <p className="mt-1 text-sm text-gray-400">Depósitos, saques e novos usuários por período, com exportação.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-[#1b2333] bg-[#0e1521] px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-[#141c2b] hover:text-white disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Filtros de período */}
      <div className="mb-6 rounded-2xl border border-white/[0.06] bg-[#0c121c] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              De
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-[#1b2333] bg-[#0e1521] px-3 py-2 text-sm text-white outline-none focus:border-orange-500/60"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Até
              <input
                type="date"
                value={to}
                min={from}
                max={todayKey(0)}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-[#1b2333] bg-[#0e1521] px-3 py-2 text-sm text-white outline-none focus:border-orange-500/60"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => applyPreset(p.days)}
                className="rounded-lg border border-[#1b2333] bg-[#0e1521] px-3 py-2 text-xs text-gray-300 transition-colors hover:border-orange-500/40 hover:text-white"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="py-16 text-center text-gray-400">Carregando relatório...</div>
      ) : s && data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              icon={ArrowDownCircle}
              label="Depósitos aprovados"
              value={fmtMoney(s.deposits.total)}
              sub={`${s.deposits.count} depósitos · ${fmtMoney(s.deposits.pending)} pendente`}
              tone="green"
            />
            <ReportCard
              icon={ArrowUpCircle}
              label="Saques aprovados"
              value={fmtMoney(s.withdrawals.total)}
              sub={`${s.withdrawals.count} saques · ${fmtMoney(s.withdrawals.pending)} pendente`}
              tone="red"
            />
            <ReportCard
              icon={Wallet}
              label="Líquido (dep - saq)"
              value={fmtMoney(s.net)}
              sub={`Ticket médio ${fmtMoney(s.avgDeposit)}`}
              tone={s.net >= 0 ? "blue" : "red"}
            />
            <ReportCard
              icon={UserPlus}
              label="Novos usuários"
              value={String(s.newUsers)}
              sub={`${s.convertedUsers} depositaram · ${s.conversionRate}% conversão`}
              tone="orange"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Depósitos x Saques" subtitle="Valores aprovados por dia">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1b2333" vertical={false} />
                  <XAxis dataKey="dia" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtMoneyShort} width={64} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "#ffffff08" }} />
                  <Bar dataKey="depositos" name="Depósitos" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="saques" name="Saques" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Novos usuários" subtitle="Cadastros por dia">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1b2333" vertical={false} />
                  <XAxis dataKey="dia" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                  <Tooltip content={<TooltipBox />} cursor={{ stroke: "#f97316", strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="usuarios" name="Usuários" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Exportação */}
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#0c121c] p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              <h3 className="text-[15px] font-semibold text-white">Exportar CSV</h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Período {from.split("-").reverse().join("/")} a {to.split("-").reverse().join("/")} · abre no Excel e no
              Google Sheets.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {exportButtons.map((b) => (
                <button
                  key={b.kind}
                  onClick={() => exportCsv(b.kind)}
                  disabled={exporting !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#1b2333] bg-[#0e1521] px-4 py-2 text-sm text-gray-200 transition-colors hover:border-orange-500/40 hover:text-white disabled:opacity-50"
                >
                  <Download className={`h-4 w-4 ${exporting === b.kind ? "animate-pulse" : ""}`} />
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela resumo diário */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c121c]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 text-right font-medium">Depósitos</th>
                    <th className="px-4 py-3 text-right font-medium">Saques</th>
                    <th className="px-4 py-3 text-right font-medium">Líquido</th>
                    <th className="px-4 py-3 text-right font-medium">Usuários</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.daily].reverse().map((r) => (
                    <tr key={r.date} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-gray-300">{r.date.split("-").reverse().join("/")}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{fmtMoney(r.depositos)}</td>
                      <td className="px-4 py-3 text-right text-red-400">{fmtMoney(r.saques)}</td>
                      <td className={`px-4 py-3 text-right ${r.liquido >= 0 ? "text-sky-400" : "text-red-400"}`}>
                        {fmtMoney(r.liquido)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{r.usuarios}</td>
                    </tr>
                  ))}
                  {data.daily.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        Nenhum dado no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
