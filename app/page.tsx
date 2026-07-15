import Link from "next/link"
import { Globe, ChevronDown } from "lucide-react"
import { CryptoTicker } from "@/components/landing/crypto-ticker"

export const metadata = {
  title: "Kodilex Broker - Trade inteligente e seguro, do seu jeito",
  description:
    "Mais que uma corretora, um ecossistema completo para você evoluir. Aprenda, teste e negocie com liberdade, transparência e proteção.",
}

export default function HomePage() {
  return (
    <main
      id="top"
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#07090d]"
    >
      {/* Fundo: plataforma de trading escurecida */}
      <div className="absolute inset-0">
        <img
          src="/images/hero-trading.png"
          alt=""
          className="h-full w-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07090d]/70 via-[#07090d]/85 to-[#07090d]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07090d] via-transparent to-[#07090d]" />
        {/* Brilho roxo de destaque */}
        <div className="absolute left-1/2 top-1/3 h-72 w-[42rem] max-w-[90%] -translate-x-1/2 rounded-full bg-[#9333ea]/15 blur-[130px]" />
      </div>

      {/* Cabeçalho com navegação em pílula */}
      <header className="relative z-30 px-4 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <img
              src="/images/kodilex-logo.png"
              alt="Kodilex Broker"
              className="h-9 w-auto object-contain sm:h-10"
            />
          </Link>

          {/* Navegação central (desktop) */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-md lg:flex">
            <Link
              href="#top"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Início
            </Link>
            <Link
              href="#cotacoes"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Cotações
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Plataforma
            </Link>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <span className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-white/70">
              <Globe className="h-4 w-4" />
              PT
            </span>
          </nav>

          {/* Ações */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth/login"
              className="rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Login
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-[#9333ea] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_rgba(147,51,234,0.8)] transition-colors hover:bg-[#a855f7]"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo do hero */}
      <section className="relative z-20 flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="animate-fade-up mx-auto max-w-4xl">
          <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Trade inteligente e seguro, do seu jeito.
          </h1>

          <p className="mt-5 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            Bem-vindo à{" "}
            <span className="bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#9333ea] bg-clip-text text-transparent">
              Kodilex
            </span>
          </p>

          <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-relaxed text-white/70 md:text-lg">
            Mais que uma corretora, somos um ecossistema completo — feito para você evoluir.
            <br className="hidden sm:block" />{" "}
            Aqui, você aprende, testa e negocia com liberdade, transparência e proteção.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/sign-up"
              className="w-full rounded-xl bg-[#9333ea] px-10 py-4 text-base font-bold text-white shadow-[0_10px_40px_-8px_rgba(147,51,234,0.8)] transition-all hover:bg-[#a855f7] sm:w-auto"
            >
              Criar conta
            </Link>
            <Link
              href="/auth/login"
              className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-10 py-4 text-base font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Faixa de cotações + indicador de rolagem */}
      <div id="cotacoes" className="relative z-20 mt-auto">
        <CryptoTicker />
        <div className="flex justify-center pb-5 pt-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md">
            <ChevronDown className="h-5 w-5 animate-bounce text-white/60" />
          </div>
        </div>
      </div>
    </main>
  )
}
