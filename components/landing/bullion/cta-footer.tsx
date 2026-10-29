import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { Reveal } from "./reveal"

export function CtaSection() {
  return (
    <section id="cadastro" className="px-6 py-24">
      <Reveal>
        <div className="bt-gradient bt-animate-glow-pulse mx-auto max-w-5xl rounded-[2.5rem] p-12 text-center md:p-20">
          <Sparkles className="mx-auto h-10 w-10 text-bt-fg" aria-hidden="true" />
          <h2 className="mt-6 font-bt-display text-3xl font-bold text-balance text-bt-fg md:text-5xl">
            Comece a investir hoje mesmo
          </h2>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-bt-fg/80">
            Crie sua conta em minutos e tenha acesso a mais de 200 ativos.
          </p>
          <Link
            href="/auth/sign-up"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-bt-bg px-8 py-4 font-semibold text-bt-fg transition-transform hover:scale-105"
          >
            Criar conta grátis
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-bt-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-bt-muted md:flex-row">
        <div className="flex items-center gap-3">
          <img
            src="/images/bullion-trader-logo.png"
            alt=""
            className="h-8 w-8 rounded-full transition-transform duration-500 hover:rotate-[360deg]"
          />
          <span>© 2026 Bullion Trader</span>
        </div>
        <p className="max-w-xl text-center md:text-right">
          Operações com ativos financeiros envolvem riscos e podem resultar em perdas.
        </p>
      </div>
    </footer>
  )
}
