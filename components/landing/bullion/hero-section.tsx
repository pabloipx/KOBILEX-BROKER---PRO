"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { PrimaryButton } from "./primary-button"
import { Reveal } from "./reveal"
import { formatChange, useLiveQuotes } from "./use-live-quotes"

export function HeroSection() {
  const quotes = useLiveQuotes()

  return (
    <section id="inicio" className="bt-hero-bg relative">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <Reveal>
          <h1 className="font-bt-display text-5xl font-extrabold leading-tight text-balance md:text-7xl">
            Uma corretora, <span className="bt-text-gradient bt-animate-shine">inúmeras oportunidades.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-bt-muted text-pretty">
            Comece a investir em criptomoedas, ações internacionais, forex e mais de 200 outros ativos, de forma
            simples.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <PrimaryButton href="/auth/sign-up">Começar agora</PrimaryButton>
            <a
              href="#ativos"
              className="inline-flex items-center gap-2 rounded-full border border-bt-border px-7 py-3.5 font-semibold transition-colors hover:bg-bt-secondary"
            >
              Saiba mais
            </a>
          </div>
        </Reveal>

        <div className="relative flex justify-center">
          <div
            aria-hidden="true"
            className="bt-animate-spin-slow pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bt-primary/30 md:h-[26rem] md:w-[26rem]"
          />
          <div
            aria-hidden="true"
            className="bt-animate-spin-slow-reverse pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-bt-glow/40 md:h-80 md:w-80"
          />
          <img
            src="/images/bullion-trader-logo.png"
            alt=""
            className="bt-animate-logo relative w-72 rounded-full md:w-96"
          />
          <div className="absolute -bottom-6 left-0 flex w-56 flex-col gap-3">
            {quotes.slice(0, 2).map((q, i) => (
              <div
                key={q.symbol}
                className="bt-glass bt-animate-floaty rounded-2xl p-4"
                style={{ animationDuration: "7s", animationDelay: `${i * 1.6}s` }}
              >
                <div className="flex justify-between text-xs text-bt-muted">
                  <span>{q.symbol}</span>
                  <span>Lucro {q.payout}%</span>
                </div>
                <div className="mt-1 flex items-end justify-between">
                  <span className="font-bt-display text-lg font-bold tabular-nums">{q.price.toFixed(q.decimals)}</span>
                  <span
                    className={cn(
                      "bt-animate-pulse-soft text-sm tabular-nums",
                      q.change >= 0 ? "text-bt-success" : "text-bt-danger",
                    )}
                  >
                    {formatChange(q.change)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 px-6 pb-16 md:grid-cols-3">
        {quotes.map((q, i) => {
          const up = q.change >= 0
          const Icon = up ? TrendingUp : TrendingDown
          return (
            <div
              key={q.symbol}
              className="bt-glass bt-animate-floaty flex items-center justify-between rounded-2xl p-5"
              style={{ animationDelay: `${i * 1.2}s` }}
            >
              <div>
                <p className="text-sm text-bt-muted">{q.symbol}</p>
                <p className="font-bt-display text-2xl font-bold tabular-nums">{q.price.toFixed(q.decimals)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-bt-muted">Variação (5m)</p>
                <p
                  className={cn(
                    "bt-animate-pulse-soft flex items-center justify-end gap-1 font-semibold tabular-nums",
                    up ? "text-bt-success" : "text-bt-danger",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {formatChange(q.change)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
