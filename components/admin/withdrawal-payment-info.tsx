"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, Wallet } from "lucide-react"

type WithdrawalPaymentSource = {
  method?: string | null
  pix_key?: string | null
  pix_key_type?: string | null
  crypto_type?: string | null
  crypto_wallet?: string | null
  holder_name?: string | null
  document?: string | null
  payment_details?: Record<string, any> | null
}

const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Celular",
  random: "Chave aleatória",
  evp: "Chave aleatória",
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={`flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
        copied ? "bg-emerald-500/15 text-emerald-400" : "bg-orange-500 text-white hover:bg-orange-600"
      }`}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="truncate text-right font-medium text-gray-200">{value}</span>
    </div>
  )
}

export function WithdrawalPaymentInfo({ withdrawal }: { withdrawal: WithdrawalPaymentSource }) {
  const details = withdrawal.payment_details || {}
  const pixKey = withdrawal.pix_key || details.pix_key || ""
  const pixKeyType = withdrawal.pix_key_type || details.pix_key_type || ""
  const cryptoWallet = withdrawal.crypto_wallet || details.crypto_wallet || details.wallet_address || ""
  const cryptoType = withdrawal.crypto_type || details.crypto_type || ""
  const holderName = withdrawal.holder_name || details.holder_name || ""
  const document = withdrawal.document || details.document || ""
  const method = withdrawal.method || (cryptoWallet && !pixKey ? "crypto" : "pix")

  if (method === "crypto" && cryptoWallet) {
    return (
      <div className="mt-3 rounded-xl border border-cyan-500/20 bg-[#0B0F14] p-3">
        <div className="mb-2 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
            Carteira {cryptoType ? cryptoType.toUpperCase() : "cripto"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 break-all rounded-lg bg-[#1A1F2E] px-3 py-2.5 font-mono text-sm text-white">
            {cryptoWallet}
          </p>
          <CopyButton value={cryptoWallet} label="Copiar endereço da carteira" />
        </div>
        {(holderName || document) && (
          <div className="mt-3 flex flex-col gap-1.5 border-t border-[#2A3142] pt-3">
            {holderName && <DetailRow label="Titular" value={holderName} />}
            {document && <DetailRow label="Documento" value={document} />}
          </div>
        )}
      </div>
    )
  }

  if (!pixKey) {
    return (
      <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-300">
        Nenhuma chave Pix registrada neste saque.
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-orange-500/25 bg-[#0B0F14] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-orange-400" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wide text-orange-400">Chave Pix</span>
        </div>
        {pixKeyType && (
          <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-orange-300">
            {PIX_TYPE_LABELS[pixKeyType] || pixKeyType}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 select-all break-all rounded-lg bg-[#1A1F2E] px-3 py-2.5 font-mono text-sm text-white">
          {pixKey}
        </p>
        <CopyButton value={pixKey} label="Copiar chave Pix" />
      </div>
      {(holderName || document) && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-[#2A3142] pt-3">
          {holderName && <DetailRow label="Titular" value={holderName} />}
          {document && <DetailRow label="Documento" value={document} />}
        </div>
      )}
    </div>
  )
}
