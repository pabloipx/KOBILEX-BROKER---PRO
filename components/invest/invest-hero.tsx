import Image from "next/image"

export function InvestHero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <Image
        src="/images/invest-bull.png"
        alt=""
        fill
        priority
        className="object-cover object-right opacity-70 md:opacity-100"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#060b1a] via-[#060b1a]/85 to-transparent" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 lg:px-6 lg:py-12">
        <span className="w-fit rounded-full bg-[#1677ff] px-4 py-1.5 text-xs font-semibold tracking-wider">
          RENDA PASSIVA
        </span>
        <h1 className="text-balance text-4xl font-bold leading-tight md:text-5xl">
          Seu dinheiro
          <br />
          <span className="text-[#c9d7f5]">trabalhando</span> <span className="text-[#3b9bff]">por você</span>
        </h1>
        <p className="max-w-xl text-pretty text-base leading-relaxed text-white/80">
          Invista a partir de <strong className="font-semibold text-white">US$ 500</strong> e receba rendimentos
          mensais com a segurança da KOBILEX. O valor investido fica aplicado por 3 meses, e você pode sacar os
          rendimentos todo mês.
        </p>
      </div>
    </section>
  )
}
