import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Shield,
  Zap,
  TrendingUp,
  Users,
  Lock,
  CheckCircle,
  ArrowRight,
  Smartphone,
  BarChart3,
  Wallet,
  ChevronRight,
} from "lucide-react"

export const metadata = {
  title: "Kodilex Broker - Plataforma de Trading Profissional",
  description: "Opere de forma simplificada em ações, criptos e câmbios.",
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#030712]">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#4c1d95] via-[#9333ea] to-[#4c1d95] text-center py-3 px-4">
        <p className="text-white text-sm font-medium">
          Bem-vindo! Cadastre-se agora e receba seu bônus exclusivo de boas-vindas!
        </p>
      </div>

      {/* Hero Section - Trading Background */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-end overflow-hidden">
        {/* Trading Background Image */}
        <div className="absolute inset-0">
          <img
            src="/images/hero-trading.png"
            alt=""
            className="w-full h-full object-cover object-center"
          />
          {/* Dark gradient overlays for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/70 to-[#030712]/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/60 via-transparent to-[#030712]" />
          {/* Blue tint overlay */}
          <div className="absolute inset-0 bg-[#1a0f2e]/30 mix-blend-multiply" />
          {/* Malha tecnologica */}
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(147, 51, 234,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(147, 51, 234,0.35) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 75%)",
            }}
          />
          {/* Brilho de destaque atras do conteudo */}
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 h-72 w-[36rem] max-w-[90%] rounded-full bg-[#9333ea]/20 blur-[120px]" />
        </div>

        {/* Header overlay */}
        <header className="absolute top-0 left-0 right-0 z-50 px-4 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <img
                src="/images/kodilex-logo.png"
                alt="Kodilex Broker"
                className="h-10 w-auto object-contain"
              />
            </Link>
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 text-sm">
                <Link href="/auth/login">Entrar</Link>
              </Button>
              <Button asChild className="bg-[#9333ea] hover:bg-[#a855f7] font-semibold text-sm">
                <Link href="/auth/sign-up">Criar Conta</Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-5xl mx-auto text-center px-6 pb-12 lg:pb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-[#9333ea]/40 bg-[#9333ea]/10 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#a855f7] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#a855f7]" />
            </span>
            <span className="text-[#d8b4fe] text-xs md:text-sm font-medium tracking-wide uppercase">
              Tecnologia de trading em tempo real
            </span>
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[1.05] mb-6 lg:mb-8 text-balance"
            style={{ textShadow: "0 4px 60px rgba(0,0,0,0.9)" }}
          >
            Opere de forma simplificada em{" "}
            <span className="bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#d8b4fe] bg-clip-text text-transparent">
              ações, criptos e câmbios!
            </span>
          </h1>
          <p className="text-white/70 text-base md:text-lg lg:text-xl leading-relaxed mb-10 lg:mb-12 max-w-2xl mx-auto text-pretty">
            Registre-se e receba R$ 10.000 na sua conta demo para aprender a negociar
          </p>

          <Button
            asChild
            size="lg"
            className="group relative bg-[#9333ea] hover:bg-[#a855f7] text-white text-base md:text-lg lg:text-xl px-10 lg:px-14 py-7 lg:py-8 rounded-xl shadow-[0_8px_40px_-8px_rgba(147, 51, 234,0.7)] hover:shadow-[0_8px_50px_-6px_rgba(168, 85, 247,0.9)] transition-all duration-300 font-bold uppercase tracking-wide"
          >
            <Link href="/auth/sign-up" className="flex items-center gap-2">
              ABRA SUA CONTA GRATUITA
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Button>

          {/* Trust indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-white/50 text-xs md:text-sm">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#a855f7]" />
              Execução instantânea
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#a855f7]" />
              Ambiente seguro
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#a855f7]" />
              Payout de 96%
            </span>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative bg-[#1a0f2e] border-y border-[#4c1d95]/30 py-10 px-4 overflow-hidden">
        {/* Malha tecnologica de fundo */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(147, 51, 234,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(147, 51, 234,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse 70% 100% at 50% 50%, #000 40%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 100% at 50% 50%, #000 40%, transparent 80%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { icon: TrendingUp, value: "96%", label: "Payout", highlight: true },
            { icon: BarChart3, value: "300+", label: "Ativos" },
            { icon: Wallet, value: "R$10k", label: "Conta Demo" },
            { icon: Shield, value: "24/7", label: "Suporte" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center transition-all duration-300 hover:border-[#9333ea]/40 hover:bg-[#9333ea]/[0.04]"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#9333ea]/10 ring-1 ring-[#9333ea]/20 transition-colors group-hover:bg-[#9333ea]/20">
                <stat.icon className="h-5 w-5 text-[#a855f7]" />
              </div>
              <p
                className={`text-3xl md:text-4xl font-bold tracking-tight ${
                  stat.highlight ? "text-[#a855f7]" : "text-white"
                }`}
              >
                {stat.value}
              </p>
              <p className="text-white/40 text-xs mt-1.5 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Assets Section */}
      <section id="assets" className="py-16 px-4 bg-[#030712]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-balance">
              Mais de <span className="text-[#9333ea]">300 ativos</span> para você escolher
            </h2>
            <p className="text-white/50 max-w-xl mx-auto text-pretty">
              Negocie com os pares e ativos mais procurados do mercado internacional.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl p-8 border border-[#9333ea]/20 bg-gradient-to-b from-[#1a0f2e] to-[#1a0f2e]/40">
            {/* Brilho de destaque */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 h-40 w-72 rounded-full bg-[#9333ea]/20 blur-[90px]" />

            <div className="relative">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9333ea]/10 ring-1 ring-[#9333ea]/30">
                <Wallet className="h-7 w-7 text-[#a855f7]" />
              </div>
              <p className="text-white/60 text-center mb-6 text-pretty">
                Deposite com segurança via PIX e comece a operar em minutos.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-7">
                <div className="flex items-center gap-2 bg-white/[0.05] px-4 py-2 rounded-lg border border-white/[0.06]">
                  <Smartphone className="w-4 h-4 text-[#a855f7]" />
                  <span className="text-white/80 text-sm font-medium">PIX Instantâneo</span>
                </div>
                <div className="flex items-center gap-2 bg-white/[0.05] px-4 py-2 rounded-lg border border-white/[0.06]">
                  <Lock className="w-4 h-4 text-[#a855f7]" />
                  <span className="text-white/80 text-sm font-medium">100% Seguro</span>
                </div>
              </div>
              <div className="text-center">
                <Button
                  asChild
                  size="lg"
                  className="group bg-[#9333ea] hover:bg-[#a855f7] text-white font-bold uppercase tracking-wide px-8 py-6 rounded-xl shadow-[0_8px_40px_-8px_rgba(147, 51, 234,0.7)] hover:shadow-[0_8px_50px_-6px_rgba(168, 85, 247,0.9)] transition-all duration-300"
                >
                  <Link href="/auth/sign-up" className="flex items-center gap-2">
                    ENTRE NA KODILEX BROKER AGORA
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 px-4 bg-[#1a0f2e]/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6 text-center text-balance">
            O que e a <span className="text-[#9333ea]">Kodilex Broker</span>?
          </h2>

          <div className="max-w-3xl mx-auto space-y-4 text-white/60 leading-relaxed text-sm text-center">
            <p>
              A Kodilex Broker e uma corretora digital moderna voltada para negociacoes rapidas e seguras no mercado
              financeiro global. Focada em eficiencia, acessibilidade e inovacao.
            </p>
            <p>
              Com uma estrutura tecnologica avancada, a Kodilex Broker oferece um ambiente estavel e confiavel para
              operar com ativos como acoes internacionais, criptomoedas, commodities e indices.
            </p>
            <p>
              A corretora se destaca por fornecer suporte tecnico qualificado, ferramentas de analise intuitivas e
              uma interface otimizada para qualquer dispositivo.
            </p>
            <div className="pt-4">
              <Button
                asChild
                variant="outline"
                className="border-[#9333ea] text-[#9333ea] hover:bg-[#9333ea]/10 bg-transparent"
              >
                <Link href="/auth/sign-up" className="flex items-center gap-2">
                  REALIZE SEU CADASTRO
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-16 px-4 bg-[#030712]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4 text-center text-balance">
            Como funciona a <span className="text-[#9333ea]">Kodilex Broker</span>?
          </h2>
          <p className="text-white/50 text-center mb-12 max-w-2xl mx-auto text-sm">
            Uma negociacao rapida, segura e eficiente por meio de uma plataforma digital intuitiva.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, title: "Cadastro Rapido", desc: "Comece com um cadastro simples e verificacao de identidade." },
              { icon: Wallet, title: "Deposito Facil", desc: "Realize depositos de forma rapida e segura via PIX." },
              { icon: BarChart3, title: "Negocie", desc: "Opere com ativos globais com graficos em tempo real." },
              { icon: Zap, title: "Saque Rapido", desc: "Retire seus lucros quando quiser com processamento agil." },
            ].map((item) => (
              <div key={item.title} className="bg-white/[0.03] rounded-xl p-5 text-center border border-white/[0.05] hover:border-[#9333ea]/30 transition-all">
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-[#9333ea]/15">
                  <item.icon className="w-6 h-6 text-[#9333ea]" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-16 px-4 bg-[#1a0f2e]/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-[#9333ea]/15">
              <Shield className="w-7 h-7 text-[#9333ea]" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4 text-balance">
              Seguranca em <span className="text-[#9333ea]">primeiro lugar</span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto text-sm">
              Na Kodilex Broker, a seguranca dos usuarios e prioridade maxima.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { icon: Lock, title: "Criptografia de Dados", desc: "Todos os dados sao protegidos com criptografia de ponta a ponta." },
              { icon: Smartphone, title: "Autenticacao 2FA", desc: "Autenticacao em duas etapas para maior seguranca." },
              { icon: TrendingUp, title: "Monitoramento 24/7", desc: "Monitoramento continuo das atividades e transacoes." },
            ].map((item) => (
              <div key={item.title} className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.05] hover:border-[#9333ea]/30 transition-all">
                <item.icon className="w-7 h-7 mb-3 text-[#9333ea]" />
                <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-5 border border-white/[0.06] bg-[#030712]/60">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#9333ea]" />
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">Conformidade Internacional</h3>
                <p className="text-white/50 text-xs leading-relaxed">
                  O processo de verificacao segue padroes internacionais, com praticas de KYC e AML, garantindo um
                  ambiente transparente e confiavel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#4c1d95] via-[#9333ea] to-[#4c1d95]" />
        <div className="absolute inset-0 bg-[url('/images/hero-trading.png')] bg-cover bg-center opacity-10" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4 text-balance">Comece a negociar agora mesmo</h2>
          <p className="text-white/80 mb-8 text-sm">
            Junte-se a milhares de traders que ja estao aproveitando as vantagens da Kodilex Broker.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-[#4c1d95] hover:bg-white/90 font-bold px-8">
              <Link href="/auth/sign-up">Criar Conta Gratis</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 bg-transparent"
            >
              <Link href="/auth/login">Ja tenho uma conta</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-[#030712] border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <img src="/images/kodilex-logo.png" alt="Kodilex Broker" className="h-8 w-auto" />
            <p className="text-white/30 text-xs text-center">2025 Kodilex Broker. Todos os direitos reservados.</p>
            <div className="flex gap-4">
              <Link href="/terms" className="text-white/30 hover:text-white text-xs">Termos</Link>
              <Link href="/privacy" className="text-white/30 hover:text-white text-xs">Privacidade</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
