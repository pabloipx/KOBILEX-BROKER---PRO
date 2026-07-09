"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Users,
  DollarSign,
  TrendingUp,
  UserPlus,
  Search,
  RefreshCw,
  Check,
  X,
  Clock,
  Edit2,
  Loader2,
} from "lucide-react"

interface Affiliate {
  id: string
  user_id: string
  code: string
  commission_rate: number
  balance: number
  total_earned: number
  total_referrals: number
  status: string
  created_at: string
  profiles: {
    full_name: string
    email: string
  }
}

interface PendingWithdrawal {
  id: string
  amount: number
  net_amount?: number | null
  fee?: number | null
  pix_key: string
  pix_key_type: string
  status: string
  created_at: string
  user_id: string
  profile?: {
    full_name: string
    email: string
    affiliate_code: string
  }
}

interface Stats {
  totalAffiliates: number
  activeAffiliates: number
  totalEarned: number
  totalReferrals: number
}

export function AdminAffiliates() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([])
  const [processedWithdrawals, setProcessedWithdrawals] = useState<PendingWithdrawal[]>([])
  const [stats, setStats] = useState<Stats>({
    totalAffiliates: 0,
    activeAffiliates: 0,
    totalEarned: 0,
    totalReferrals: 0,
  })

  // Funcao helper para formatar valores com seguranca
  const formatCurrency = (value: number | undefined | null) => {
    return (value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
  }
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingAffiliate, setEditingAffiliate] = useState<string | null>(null)
  const [editingBalance, setEditingBalance] = useState<string | null>(null)
  const [newCommission, setNewCommission] = useState("")
  const [newBalance, setNewBalance] = useState("")
  const [processingWithdrawal, setProcessingWithdrawal] = useState<string | null>(null)

  const ADMIN_TOKEN = "Admin123!"

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/affiliates", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      
      if (!response.ok) {
        console.error("Erro na resposta:", response.status)
        setLoading(false)
        return
      }
      
      const data = await response.json()
      
      setAffiliates(data.affiliates || [])
      setPendingWithdrawals(data.pendingWithdrawals || [])
      setProcessedWithdrawals(data.processedWithdrawals || [])
      setStats({
        totalAffiliates: data.stats?.totalAffiliates || 0,
        activeAffiliates: data.stats?.activeAffiliates || 0,
        totalEarned: data.stats?.totalEarned || 0,
        totalReferrals: data.stats?.totalReferrals || 0,
      })
    } catch (error) {
      console.error("Erro ao carregar afiliados:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateCommission = async (affiliateId: string) => {
    try {
      await fetch("/api/admin/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          affiliateId,
          action: "update_commission",
          data: { commission_rate: Number.parseFloat(newCommission) },
        }),
      })
      setEditingAffiliate(null)
      loadData()
    } catch (error) {
      console.error("Erro ao atualizar comissao:", error)
    }
  }

  const updateBalance = async (affiliateId: string) => {
    try {
      await fetch("/api/admin/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          affiliateId,
          action: "update_balance",
          data: { balance: Number.parseFloat(newBalance) },
        }),
      })
      setEditingBalance(null)
      loadData()
    } catch (error) {
      console.error("Erro ao atualizar saldo:", error)
    }
  }

  const toggleStatus = async (affiliateId: string, currentStatus: string) => {
    try {
      await fetch("/api/admin/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          affiliateId,
          action: "update_status",
          data: { status: currentStatus === "active" ? "inactive" : "active" },
        }),
      })
      loadData()
    } catch (error) {
      console.error("Erro ao atualizar status:", error)
    }
  }

  const processWithdrawal = async (withdrawalId: string, status: "completed" | "rejected") => {
    setProcessingWithdrawal(withdrawalId)
    try {
      const response = await fetch("/api/admin/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          affiliateId: null,
          action: "process_withdrawal",
          data: { withdrawalId, status },
        }),
      })
      
      const result = await response.json()
      if (!response.ok) {
        console.error("Erro ao processar saque:", result.error)
        alert(`Erro: ${result.error || "Falha ao processar saque"}`)
      }
      
      loadData()
    } catch (error) {
      console.error("Erro ao processar saque:", error)
      alert("Erro ao processar saque. Tente novamente.")
    } finally {
      setProcessingWithdrawal(null)
    }
  }

  const filteredAffiliates = affiliates.filter(
    (a) =>
      a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#9333ea] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#9333ea]/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#9333ea]" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Total Afiliados</p>
              <p className="text-white text-xl font-bold">{stats.totalAffiliates}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#9333ea]/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-[#9333ea]" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Ativos</p>
              <p className="text-white text-xl font-bold">{stats.activeAffiliates}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#9333ea]/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#9333ea]" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Total Pago</p>
              <p className="text-white text-xl font-bold">
                R$ {formatCurrency(stats.totalEarned)}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#9333ea]/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#9333ea]" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Total Referidos</p>
              <p className="text-white text-xl font-bold">{stats.totalReferrals}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <div className="p-4 rounded-xl bg-[#121826] border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-yellow-500" />
            <h3 className="text-white font-semibold">Saques Pendentes ({pendingWithdrawals.length})</h3>
          </div>
          <div className="space-y-3">
            {pendingWithdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="p-4 rounded-lg bg-[#0a0e17] border border-[#1F2933] flex items-center justify-between"
              >
                <div>
                  <p className="text-white font-medium">
                    {withdrawal.profile?.full_name || "Afiliado"}
                  </p>
                  <p className="text-white/40 text-xs">
                    Codigo: {withdrawal.profile?.affiliate_code || "N/A"} | PIX: {withdrawal.pix_key}
                  </p>
                  <div className="mt-1">
                    <p className="text-[#22c55e] text-base font-semibold">
                      R$ {formatCurrency(withdrawal.net_amount ?? withdrawal.amount * 0.98)}
                      <span className="text-white/40 text-xs font-normal"> a pagar</span>
                    </p>
                    <p className="text-white/30 text-[11px]">
                      Solicitado R$ {formatCurrency(withdrawal.amount)} · taxa R${" "}
                      {formatCurrency(withdrawal.fee ?? withdrawal.amount * 0.02)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {processingWithdrawal === withdrawal.id ? (
                    <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
                  ) : (
                    <>
                      <button
                        onClick={() => processWithdrawal(withdrawal.id, "completed")}
                        className="p-2 rounded-lg bg-[#9333ea] hover:bg-[#9333ea]/80 text-white"
                        title="Aprovar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => processWithdrawal(withdrawal.id, "rejected")}
                        className="p-2 rounded-lg bg-red-500 hover:bg-red-500/80 text-white"
                        title="Rejeitar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed Withdrawals (histórico aprovados/recusados) */}
      {processedWithdrawals.length > 0 && (
        <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
          <div className="flex items-center gap-2 mb-4">
            <Check className="w-5 h-5 text-white/60" />
            <h3 className="text-white font-semibold">Saques Processados ({processedWithdrawals.length})</h3>
          </div>
          <div className="space-y-3">
            {processedWithdrawals.map((withdrawal) => {
              const isApproved = withdrawal.status === "approved" || withdrawal.status === "completed"
              return (
                <div
                  key={withdrawal.id}
                  className="p-4 rounded-lg bg-[#0a0e17] border border-[#1F2933] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      {withdrawal.profile?.full_name || "Afiliado"}
                    </p>
                    <p className="text-white/40 text-xs truncate">
                      Codigo: {withdrawal.profile?.affiliate_code || "N/A"} | PIX: {withdrawal.pix_key}
                    </p>
                    <p className="text-white/60 text-sm mt-1">R$ {formatCurrency(withdrawal.amount)}</p>
                  </div>
                  <span
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                      isApproved ? "bg-[#9333ea]/20 text-[#9333ea]" : "bg-red-500/20 text-red-500"
                    }`}
                  >
                    {isApproved ? "Aprovado" : "Recusado"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Affiliates List */}
      <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Lista de Afiliados</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 rounded-lg bg-[#0a0e17] border border-[#1F2933] text-white text-sm focus:border-[#9333ea] outline-none"
              />
            </div>
            <button
              onClick={loadData}
              className="p-2 rounded-lg bg-[#0a0e17] border border-[#1F2933] hover:bg-[#1F2933]"
            >
              <RefreshCw className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2933]">
                <th className="text-left text-white/40 text-xs font-medium py-3 px-2">Afiliado</th>
                <th className="text-left text-white/40 text-xs font-medium py-3 px-2">Código</th>
                <th className="text-left text-white/40 text-xs font-medium py-3 px-2">Comissão</th>
                <th className="text-left text-white/40 text-xs font-medium py-3 px-2">Saldo</th>
                <th className="text-left text-white/40 text-xs font-medium py-3 px-2">Total Ganho</th>
                <th className="text-left text-white/40 text-xs font-medium py-3 px-2">Referidos</th>
                <th className="text-left text-white/40 text-xs font-medium py-3 px-2">Status</th>
                <th className="text-left text-white/40 text-xs font-medium py-3 px-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAffiliates.map((affiliate) => (
                <tr key={affiliate.id} className="border-b border-[#1F2933]/50 hover:bg-white/5">
                  <td className="py-3 px-2">
                    <div>
                      <p className="text-white text-sm">{affiliate.profiles?.full_name || "N/A"}</p>
                      <p className="text-white/40 text-xs">{affiliate.profiles?.email || "N/A"}</p>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-[#9333ea] font-mono font-bold text-sm">{affiliate.code}</span>
                  </td>
                  <td className="py-3 px-2">
                    {editingAffiliate === affiliate.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={newCommission}
                          onChange={(e) => setNewCommission(e.target.value)}
                          className="w-16 px-2 py-1 rounded bg-[#0a0e17] border border-[#1F2933] text-white text-sm"
                          step="0.5"
                        />
                        <button
                          onClick={() => updateCommission(affiliate.id)}
                          className="p-1 rounded bg-[#9333ea] text-white"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingAffiliate(null)}
                          className="p-1 rounded bg-red-500 text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-white text-sm">{affiliate.commission_rate || 5}%</span>
                        <button
                          onClick={() => {
                            setEditingAffiliate(affiliate.id)
                            setNewCommission((affiliate.commission_rate || 5).toString())
                          }}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          <Edit2 className="w-3 h-3 text-white/40" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {editingBalance === affiliate.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={newBalance}
                          onChange={(e) => setNewBalance(e.target.value)}
                          className="w-20 px-2 py-1 rounded bg-[#0a0e17] border border-[#1F2933] text-white text-sm"
                          step="0.01"
                        />
                        <button
                          onClick={() => updateBalance(affiliate.id)}
                          className="p-1 rounded bg-[#9333ea] text-white"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingBalance(null)}
                          className="p-1 rounded bg-red-500 text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-white text-sm">
                          R$ {formatCurrency(affiliate.balance)}
                        </span>
                        <button
                          onClick={() => {
                            setEditingBalance(affiliate.id)
                            setNewBalance((affiliate.balance || 0).toString())
                          }}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          <Edit2 className="w-3 h-3 text-white/40" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-[#9333ea] text-sm font-medium">
                      R$ {formatCurrency(affiliate.total_earned)}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-white text-sm">{affiliate.total_referrals || 0}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        affiliate.status === "active"
                          ? "bg-[#9333ea]/20 text-[#9333ea]"
                          : "bg-red-500/20 text-red-500"
                      }`}
                    >
                      {affiliate.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => toggleStatus(affiliate.id, affiliate.status)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        affiliate.status === "active"
                          ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                          : "bg-[#9333ea]/20 text-[#9333ea] hover:bg-[#9333ea]/30"
                      }`}
                    >
                      {affiliate.status === "active" ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
