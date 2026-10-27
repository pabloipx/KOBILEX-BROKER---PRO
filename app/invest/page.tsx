import type { Metadata } from "next"
import { InvestHeader } from "@/components/invest/invest-header"
import { InvestHero } from "@/components/invest/invest-hero"
import { InvestSimulator } from "@/components/invest/invest-simulator"
import { MyInvestments } from "@/components/invest/my-investments"
import { InvestFeatures } from "@/components/invest/invest-features"

export const metadata: Metadata = {
  title: "Renda Passiva | KOBILEX",
  description:
    "Invista a partir de US$ 500 e receba rendimentos mensais de 10% com a segurança da KOBILEX.",
}

export default function InvestPage() {
  return (
    <div className="min-h-dvh bg-[#060b1a] text-white">
      <InvestHeader />
      <main>
        <InvestHero />
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 lg:flex-row lg:items-start lg:gap-6 lg:px-6">
          <div className="lg:flex-[1.1]">
            <InvestSimulator />
          </div>
          <div className="lg:flex-1">
            <MyInvestments />
          </div>
        </div>
      </main>
      <InvestFeatures />
    </div>
  )
}
