"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Forward, HelpCircle } from "lucide-react"

const fmt = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Props = {
  accountType: "demo" | "real"
  balanceReal: number
  balanceDemo: number
  invested: number
  onChangeAccount: (type: "demo" | "real") => void
}

export function TraderoomBalanceMenu({ accountType, balanceReal, balanceDemo, invested, onChangeAccount }: Props) {
  const [open, setOpen] = useState(false)
  const current = accountType === "demo" ? balanceDemo : balanceReal

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex flex-col items-end lg:flex-row lg:items-center gap-0.5 lg:gap-1.5 text-tr-fg"
      >
        <span className="text-sm lg:text-xl font-bold tabular-nums whitespace-nowrap">R$ {fmt(current)}</span>
        <span className="flex items-center gap-0.5">
          <span className={`text-[10px] lg:hidden ${accountType === "demo" ? "text-tr-warn" : "text-tr-up"}`}>
            {accountType === "demo" ? "Prática" : "Real"}
          </span>
          <ChevronDown className="w-3 h-3 lg:w-4 lg:h-4" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="fixed right-2 top-14 lg:top-[71px] z-50 flex flex-col sm:flex-row w-[calc(100vw-16px)] sm:w-[610px] bg-tr-raised shadow-2xl">
            <div className="flex flex-col justify-between gap-6 p-6 sm:w-[270px] text-sm">
              <dl className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <dt className="text-tr-muted">Disponível</dt>
                  <dd className="font-bold text-tr-fg tabular-nums">R$ {fmt(current)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tr-muted">Investimento</dt>
                  <dd className="font-bold text-tr-fg tabular-nums">R$ {fmt(invested)}</dd>
                </div>
              </dl>
              <p className="flex items-center gap-1.5 text-xs text-tr-muted">
                <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Saldo disponível para novas operações
              </p>
            </div>

            <div className="flex flex-1 flex-col bg-tr-panel">
              <AccountRow
                label="Conta real"
                value={`R$ ${fmt(balanceReal)}`}
                valueClass="text-tr-up"
                active={accountType === "real"}
                onSelect={() => {
                  onChangeAccount("real")
                  setOpen(false)
                }}
                action={
                  <Link
                    href="/deposit"
                    className="flex items-center gap-3 bg-tr-raised px-4 py-2 text-xs text-tr-fg hover:bg-tr-line transition-colors"
                  >
                    <Forward className="w-4 h-4 text-tr-muted" aria-hidden="true" />
                    Depositar
                  </Link>
                }
              />
              <AccountRow
                label="Conta de prática"
                value={`R$ ${fmt(balanceDemo)}`}
                valueClass="text-tr-fg"
                active={accountType === "demo"}
                onSelect={() => {
                  onChangeAccount("demo")
                  setOpen(false)
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AccountRow({
  label,
  value,
  valueClass,
  active,
  onSelect,
  action,
}: {
  label: string
  value: string
  valueClass: string
  active: boolean
  onSelect: () => void
  action?: React.ReactNode
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-6 py-4 border-l-2 ${
        active ? "border-tr-brand bg-tr-raised/40" : "border-transparent"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex flex-col items-start text-left" aria-pressed={active}>
        <span className="text-xs font-bold uppercase text-tr-fg">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</span>
      </button>
      {action}
    </div>
  )
}
