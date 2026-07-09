"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle, XCircle, Clock, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Deposit {
  id: string
  user_id: string
  amount: number
  status: string
  payment_method: string
  created_at: string
  user_email?: string
}

interface AdminDepositsProps {
  onUpdate: () => void
}

export function AdminDeposits({ onUpdate }: AdminDepositsProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "rejected">("all")

  useEffect(() => {
    loadDeposits()
  }, [])

  const loadDeposits = async () => {
    try {
      const supabase = createClient()

      const { data, error } = await supabase.from("deposits").select("*").order("created_at", { ascending: false })

      if (error) throw error

      // Get user emails
      const depositsWithEmails = await Promise.all(
        (data || []).map(async (deposit) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", deposit.user_id)
            .maybeSingle()

          return {
            ...deposit,
            user_email: profile?.email || "Desconhecido",
          }
        }),
      )

      setDeposits(depositsWithEmails)
    } catch (error) {
      console.error("Error loading deposits:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateDepositStatus = async (id: string, status: "completed" | "rejected", userId: string, amount: number) => {
    try {
      const supabase = createClient()

      await supabase
        .from("deposits")
        .update({
          status,
          processed_at: new Date().toISOString(),
        })
        .eq("id", id)

      // If approved, add to user balance
      if (status === "completed") {
        const { data: currentBalance } = await supabase
          .from("user_balances")
          .select("balance_real")
          .eq("user_id", userId)
          .maybeSingle()

        const newBalance = (currentBalance?.balance_real || 0) + amount

        await supabase.from("user_balances").upsert({
          user_id: userId,
          balance_real: newBalance,
          updated_at: new Date().toISOString(),
        })
      }

      loadDeposits()
      onUpdate()
    } catch (error) {
      console.error("Error updating deposit:", error)
    }
  }

  const filteredDeposits = deposits.filter((deposit) => {
    const matchesSearch = deposit.user_email?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === "all" || deposit.status === filter
    return matchesSearch && matchesFilter
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            <CheckCircle className="w-3 h-3" />
            Aprovado
          </span>
        )
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            <XCircle className="w-3 h-3" />
            Rejeitado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Depósitos</h1>
          <p className="text-gray-400 mt-1">Gerencie os depósitos dos usuários</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Buscar por email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#0D1117] border-[#1E2430] text-white placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "completed", "rejected"] as const).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className={
                filter === f
                  ? "bg-[#9333ea] hover:bg-[#7e22ce]"
                  : "border-[#2A3142] bg-transparent text-gray-300 hover:bg-[#1E2430]"
              }
            >
              {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : f === "completed" ? "Aprovados" : "Rejeitados"}
            </Button>
          ))}
        </div>
      </div>

      {/* Deposits Table */}
      <div className="bg-[#0D1117] border border-[#1E2430] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2430]">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Usuário
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Valor
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Método
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Data</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2430]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhum depósito encontrado
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-[#1E2430]/50">
                    <td className="px-4 py-3">
                      <span className="text-white">{deposit.user_email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-green-500 font-medium">{formatCurrency(deposit.amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400">{deposit.payment_method || "PIX"}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(deposit.status)}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {new Date(deposit.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deposit.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() =>
                              updateDepositStatus(deposit.id, "completed", deposit.user_id, deposit.amount)
                            }
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Aprovar
                          </Button>
                          <Button
                            onClick={() => updateDepositStatus(deposit.id, "rejected", deposit.user_id, deposit.amount)}
                            size="sm"
                            variant="outline"
                            className="border-red-500 text-red-500 hover:bg-red-500/10"
                          >
                            Rejeitar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
