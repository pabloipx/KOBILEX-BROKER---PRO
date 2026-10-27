"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Bell, BadgeCheck, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const TICKERS = [
  { symbol: "BTC", price: "$67,432.21", change: "+2.48%", color: "bg-[#f7931a]", letter: "₿" },
  { symbol: "ETH", price: "$3,245.76", change: "+3.12%", color: "bg-[#627eea]", letter: "Ξ" },
  { symbol: "SOL", price: "$158.42", change: "+4.76%", color: "bg-gradient-to-br from-[#9945ff] to-[#14f195]", letter: "S" },
]

export function InvestHeader() {
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return
      const meta = data.user.user_metadata ?? {}
      setName(meta.full_name || meta.name || data.user.email?.split("@")[0] || null)
    })
    return () => {
      active = false
    }
  }, [supabase])

  return (
    <header className="border-b border-white/10 bg-[#070d1f]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 lg:px-6">
        <Link
          href="/trade"
          aria-label="Voltar"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/80 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <ul className="hidden items-center gap-3 md:flex" aria-label="Cotações">
          {TICKERS.map((t) => (
            <li
              key={t.symbol}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-bold text-white ${t.color}`}
                aria-hidden="true"
              >
                {t.letter}
              </span>
              <span className="font-semibold">{t.symbol}</span>
              <span className="text-white/80">{t.price}</span>
              <span className="text-emerald-400">{t.change}</span>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            aria-label="Notificações"
            className="flex size-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/5"
          >
            <Bell className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#1677ff]" aria-hidden="true">
              <UserRound className="size-5" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="max-w-[140px] truncate text-sm font-medium">{name ?? "Minha conta"}</span>
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                Conta Verificada <BadgeCheck className="size-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <ul className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden" aria-label="Cotações">
        {TICKERS.map((t) => (
          <li
            key={t.symbol}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${t.color}`}
              aria-hidden="true"
            >
              {t.letter}
            </span>
            <span className="font-semibold">{t.symbol}</span>
            <span className="text-white/80">{t.price}</span>
            <span className="text-emerald-400">{t.change}</span>
          </li>
        ))}
      </ul>
    </header>
  )
}
