"use client"

import type React from "react"

import { useState } from "react"
import { CalendarDays, CheckCircle2, CircleDashed, Download, Loader2 } from "lucide-react"
import { brl, shortDate, type AffiliateInfo, type AffiliateWithdrawal } from "./types"

interface SectionPaymentsProps {
  affiliate: AffiliateInfo
  withdrawals: AffiliateWithdrawal[]
  nextPayment: string
  onRefresh: () => void
}

const MIN_WITHDRAWAL = 50

export function SectionPayments({ affiliate, withdrawals, nextPayment, onRefresh }: SectionPaymentsProps) {
  const [tab, setTab] = useState<"payments" | "history" | "settings">("payments")
  const [amount, setAmount] = useState("")
  const [pixKeyType, setPixKeyType] = useState("cpf")
  const [pixKey, setPixKey] = useState("")
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canWithdraw = affiliate.balance >= MIN_WITHDRAWAL

  const requestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const value = Number(amount)
    if (!value || value < MIN_WITHDRAWAL) {
      setMessage({ type: "error", text: `O valor mínimo para saque é ${brl(MIN_WITHDRAWAL)}` })
      return
    }
    if (value > affiliate.balance) {
      setMessage({ type: "error", text: "Saldo insuficiente para este saque" })
      return
    }
    if (!pixKey.trim()) {
      setMessage({ type: "error", text: "Informe a sua chave PIX" })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, pixKey: pixKey.trim(), pixKeyType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao solicitar saque")

      setMessage({ type: "ok", text: "Saque solicitado. O pagamento será processado em até 24h." })
      setAmount("")
      setPixKey("")
      onRefresh()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao solicitar saque" })
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = (status: string) => {
    if (status === "approved" || status === "completed" || status === "paid") return "Pago"
    if (status === "rejected" || status === "cancelled") return "Rejeitado"
    return "Em análise"
  }

  const statusClass = (status: string) => {
    if (status === "approved" || status === "completed" || status === "paid") return "bg-emerald-50 text-emerald-700"
    if (status === "rejected" || status === "cancelled") return "bg-red-50 text-red-600"
    return "bg-amber-50 text-amber-700"
  }

  const inputClass =
    "h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Configurações de pagamento</h1>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Próximo pagamento</p>
            <CalendarDays className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-4 text-[26px] font-semibold text-gray-900">{nextPayment}</p>
          <p className="mt-1 text-[15px] text-gray-500">Datas de pagamentos regulares</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Disponível para retirada</p>
            <Download className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-4 text-[26px] font-semibold text-gray-900">{brl(affiliate.balance)}</p>
          <p className="mt-1 text-[15px] text-gray-500">Fundos disponíveis para você</p>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-gray-200">
        {(
          [
            { key: "payments", label: "Pagamentos" },
            { key: "history", label: "Histórico" },
            { key: "settings", label: "Configurações" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 pb-3 text-[15px] transition-colors ${
              tab === item.key
                ? "border-emerald-500 font-medium text-emerald-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "payments" && (
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="rounded-t-xl bg-amber-50/60 px-6 py-5">
              <p className="text-[17px] font-medium text-gray-900">Pagamentos regulares</p>
              <p className="text-[15px] text-gray-600">{canWithdraw ? "Disponíveis" : "Indisponíveis"}</p>
            </div>

            <div className="flex flex-col gap-3 px-6 py-6">
              <p className="flex items-center gap-2 text-[15px] text-gray-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Conta de afiliado ativa
              </p>
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-2 text-[15px] text-gray-800">
                  {canWithdraw ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <CircleDashed className="h-5 w-5 text-gray-400" />
                  )}
                  Ter pelo menos {brl(MIN_WITHDRAWAL)} no saldo disponível
                </p>
                <p className="pl-7 text-sm text-gray-500">Seu saldo: {brl(affiliate.balance)}</p>
              </div>
            </div>
          </section>

          <form onSubmit={requestWithdrawal} className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-[17px] font-medium text-gray-900">Solicitar pagamento via PIX</p>
            <p className="mt-1 text-[15px] text-gray-600">Taxa de 2% sobre o valor solicitado</p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="pay-amount" className="text-[15px] text-gray-700">
                  Valor
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  min={MIN_WITHDRAWAL}
                  step="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="pay-key-type" className="text-[15px] text-gray-700">
                  Tipo de chave
                </label>
                <select
                  id="pay-key-type"
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave aleatória</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="pay-key" className="text-[15px] text-gray-700">
                  Chave PIX
                </label>
                <input
                  id="pay-key"
                  type="text"
                  placeholder="Sua chave PIX"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>
            </div>

            {message && (
              <p
                className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${
                  message.type === "ok"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !canWithdraw}
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-6 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Solicitar pagamento
            </button>
          </form>
        </div>
      )}

      {tab === "history" && (
        <section className="rounded-xl border border-gray-200 bg-white">
          {withdrawals.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <h2 className="text-[22px] font-semibold text-gray-900">Sem pagamentos</h2>
              <p className="mt-2 text-[15px] text-gray-600">Seus saques aparecerão aqui após a primeira solicitação.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-sm text-gray-600">
                  <tr>
                    <th className="px-6 py-3 font-medium">Data</th>
                    <th className="px-6 py-3 font-medium">Valor</th>
                    <th className="px-6 py-3 font-medium">Taxa</th>
                    <th className="px-6 py-3 font-medium">Líquido</th>
                    <th className="px-6 py-3 font-medium">Chave PIX</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-[15px] text-gray-800">
                  {withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id} className="border-t border-gray-100">
                      <td className="px-6 py-4">{shortDate(withdrawal.created_at)}</td>
                      <td className="px-6 py-4">{brl(withdrawal.amount)}</td>
                      <td className="px-6 py-4">{brl(withdrawal.fee)}</td>
                      <td className="px-6 py-4 font-medium">{brl(withdrawal.net_amount)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{withdrawal.pix_key}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-md px-2.5 py-1 text-sm font-medium ${statusClass(withdrawal.status)}`}
                        >
                          {statusLabel(withdrawal.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "settings" && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-[17px] font-medium text-gray-900">Método de pagamento</p>
          <p className="mt-1 text-[15px] text-gray-600">
            Os pagamentos são realizados via PIX. A chave é informada em cada solicitação de saque.
          </p>

          <dl className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <dt className="text-sm text-gray-500">Comissão</dt>
              <dd className="mt-1 text-[17px] font-semibold text-gray-900">{affiliate.commission_rate}%</dd>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <dt className="text-sm text-gray-500">Saque mínimo</dt>
              <dd className="mt-1 text-[17px] font-semibold text-gray-900">{brl(MIN_WITHDRAWAL)}</dd>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <dt className="text-sm text-gray-500">Taxa de saque</dt>
              <dd className="mt-1 text-[17px] font-semibold text-gray-900">2%</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  )
}
