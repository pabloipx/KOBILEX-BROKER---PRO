import type { Metadata } from "next"
import { Manrope, Sora } from "next/font/google"
import { SiteHeader } from "@/components/landing/bullion/site-header"
import { HeroSection } from "@/components/landing/bullion/hero-section"
import { AssetsSection } from "@/components/landing/bullion/assets-section"
import { DepositSection } from "@/components/landing/bullion/deposit-section"
import { StrategySection } from "@/components/landing/bullion/strategy-section"
import { TestimonialsSection, ToolsSection } from "@/components/landing/bullion/tools-section"
import { CtaSection, SiteFooter } from "@/components/landing/bullion/cta-footer"

const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-sora" })
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-manrope" })

export const metadata: Metadata = {
  title: "Bullion Trader — Uma corretora, inúmeras oportunidades",
  description: "Invista em criptomoedas, ações internacionais, forex e mais de 200 ativos de forma simples.",
  openGraph: {
    title: "Bullion Trader — Uma corretora, inúmeras oportunidades",
    description: "Invista em criptomoedas, ações, forex e mais de 200 ativos de forma simples.",
    type: "website",
  },
}

export default function HomePage() {
  return (
    <div
      className={`${sora.variable} ${manrope.variable} min-h-screen overflow-x-hidden bg-bt-bg font-bt-body text-bt-fg`}
    >
      <SiteHeader />
      <main>
        <HeroSection />
        <AssetsSection />
        <DepositSection />
        <StrategySection />
        <ToolsSection />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  )
}
