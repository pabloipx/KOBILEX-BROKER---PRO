"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, Coins, TrendingUp } from "lucide-react"

const MIN_AMOUNT = 500
const MONTHLY_RATE = 0.1
const LOCK_MONTHS = 3
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000]

const usd = (value: number) =>
  `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const usdShort = (value: number) => `US$ ${value.toLocaleString("pt-BR")}`

export function InvestSimulator() {
  const [amount, setAmount] = useState(MIN_AMOUNT)
  const [input, setInput] = useState(usd(MIN_AMOUNT))

  const monthly = amount * MONTHLY_RATE
  const total = amount + monthly * LOCK_MONTHS
  const belowMin = amount < MIN_AMOUNT

  function selectAmount(value: number) {
    setAmount(value)
    setInput(usd(value))
  }

  function handleInput(raw: string) {
    const digits = raw.replace(/\D/g, "")
    const value = digits ? Number(digits) / 100 : 0
    setAmount(value)
    setInput(usd(value))
  }

  return (
    <section
      aria-labelledby="simulate-title"
      className="rounded-2xl border border-white/10 bg-[#0a1226]/80 p-5 shadow-[0_0_40px_-20px_#1677ff]"
    >
      <div className="flex items-start gap-3">
        <Coins className="mt-0.5 size-8 shrink-0 text-[#3b9bff]" aria-hidden="true" />
        <div>
          <h2 id="simulate-title" className="text-xl font-semibold">
            Simule seu investimento
          </h2>
          <p className="text-sm text-white/60">Digite o valor que deseja investir e veja quanto irá render.</p>
        </div>
      </div>

      <label htmlFor="invest-amount" className="mt-5 block text-sm text-white/70">
        Valor do investimento
      </label>
      <input
        id="invest-amount"
        inputMode="numeric"
        value={input}
        onChange={(e) => handleInput(e.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-white/15 bg-[#050a18] px-4 text-base text-white outline-none transition-colors focus:border-[#1677ff]"
      />
      {belowMin && <p className="mt-2 text-sm text-red-400">O valor mínimo é {usdShort(MIN_AMOUNT)}.</p>}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {QUICK_AMOUNTS.map((value) => {
          const selected = amount === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => selectAmount(value)}
              aria-pressed={selected}
              className={`h-11 shrink-0 rounded-lg border px-4 text-sm transition-colors ${
                selected
                  ? "border-[#1677ff] bg-[#1677ff]/20 text-[#3b9bff]"
                  : "border-white/10 bg-white/[0.02] text-white/80 hover:border-white/25"
              }`}
            >
              {usdShort(value)}
            </button>
          )
        })}
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-[#050a18] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="size-9 shrink-0 text-[#3b9bff]" aria-hidden="true" />
            <div>
              <p className="text-sm text-white/80">Rendimento mensal (10%)</p>
              <p className="text-2xl font-bold text-[#3b9bff]">{usd(belowMin ? 0 : monthly)}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-white/70">Valor total em 3 meses (bloqueado)</p>
            <p className="text-lg font-semibold">{usd(belowMin ? 0 : total)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-3 border-t border-white/10 pt-4">
          <CalendarDays className="size-6 shrink-0 text-white/70" aria-hidden="true" />
          <div className="text-sm">
            <p className="text-white/80">Rendimento liberado todo dia 30</p>
            <p className="text-[#3b9bff]">
              Você pode sacar o rendimento mensal <span className="underline">(todo dia 30)</span>
            </p>
          </div>
        </div>
      </div>

      {belowMin ? (
        <button
          type="button"
          disabled
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1677ff]/40 font-medium text-white/60"
        >
          Confirmar Investimento <ArrowRight className="size-4" />
        </button>
      ) : (
        <Link
          href={`/deposit?amount=${amount}`}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1677ff] font-medium transition-colors hover:bg-[#0f63d6]"
        >
          Confirmar Investimento <ArrowRight className="size-4" />
        </Link>
      )}
    </section>
  )
}
