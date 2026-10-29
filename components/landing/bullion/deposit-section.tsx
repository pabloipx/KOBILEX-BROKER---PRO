"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { PrimaryButton } from "./primary-button"
import { Reveal } from "./reveal"

const AMOUNTS = [60, 100, 250, 500, 750, 1000]

export function DepositSection() {
  const [amount, setAmount] = useState(AMOUNTS[0])

  return (
    <section id="agilidade" className="py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
        <Reveal>
          <h2 className="font-bt-display text-3xl font-bold text-balance md:text-5xl">
            Depósito rápido, <span className="bt-text-gradient bt-animate-shine">saque mais rápido ainda!</span>
          </h2>
          <p className="mt-6 leading-relaxed text-bt-muted">
            Seu depósito na plataforma é imediato e, após lucrar, você pode sacar tudo na hora.
          </p>
          <div className="mt-8">
            <PrimaryButton href="/auth/sign-up">Depositar agora</PrimaryButton>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="bt-glass bt-animate-glow-pulse rounded-3xl p-8">
            <p id="deposit-label" className="text-sm text-bt-muted">
              Informe o valor
            </p>
            <div role="radiogroup" aria-labelledby="deposit-label" className="mt-4 grid grid-cols-3 gap-3">
              {AMOUNTS.map((value) => {
                const selected = value === amount
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAmount(value)}
                    className={cn(
                      "rounded-xl py-3 text-center font-semibold transition-transform duration-200 hover:scale-105",
                      selected ? "bt-gradient text-bt-fg" : "bg-bt-secondary",
                    )}
                  >
                    R$ {value}
                  </button>
                )
              })}
            </div>
            <div className="mt-6 rounded-xl bg-bt-secondary p-4 text-sm text-bt-muted">Código promocional</div>
            <Link
              href="/auth/sign-up"
              className="bt-gradient bt-animate-shine mt-6 block rounded-full py-3.5 text-center font-semibold text-bt-fg transition-transform hover:scale-[1.02]"
            >
              Depositar R$ {amount}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
