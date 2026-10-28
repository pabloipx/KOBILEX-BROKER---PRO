import { Reveal } from "./reveal"

const ASSETS = ["Bitcoin", "Ethereum", "Ouro", "EUR/USD", "Apple", "Tesla", "Petróleo", "Amazon", "GBP/JPY", "Solana"]

export function AssetsSection() {
  return (
    <section id="ativos" className="py-24">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <Reveal>
          <p className="bt-text-gradient bt-animate-shine font-bt-display text-6xl font-extrabold">+200</p>
          <h2 className="mt-4 font-bt-display text-3xl font-bold text-balance md:text-5xl">
            Ativos para investir, de forma descomplicada.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-bt-muted">
            Escolha um dos ativos e comece a investir com apenas alguns cliques.
          </p>
        </Reveal>
        <ul className="mt-12 flex flex-wrap justify-center gap-3">
          {ASSETS.map((asset, i) => (
            <li key={asset}>
              <Reveal delay={i * 60}>
                <span className="bt-glass bt-hover-text-gradient inline-block rounded-full px-5 py-2.5 text-sm font-medium transition-transform duration-300 hover:scale-110">
                  {asset}
                </span>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
