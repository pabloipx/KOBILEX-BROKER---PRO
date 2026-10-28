import Link from "next/link"

const NAV = [
  { href: "#ativos", label: "Ativos" },
  { href: "#agilidade", label: "Agilidade" },
  { href: "#ferramentas", label: "Ferramentas" },
  { href: "#depoimentos", label: "Depoimentos" },
]

export function SiteHeader() {
  return (
    <>
      <div className="bg-bt-secondary px-4 py-2 text-center text-xs text-bt-muted">
        Investir envolve riscos. Leia os termos de uso antes de operar.
      </div>
      <header className="bt-glass sticky top-0 z-50 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#inicio" className="group flex items-center gap-3">
            <img
              src="/images/bullion-trader-logo.png"
              alt="Bullion Trader"
              className="bt-shadow-glow h-10 w-10 rounded-full transition-transform duration-500 group-hover:rotate-[360deg] group-hover:scale-110"
            />
            <span className="bt-group-hover-text-gradient font-bt-display text-lg font-bold transition-colors">
              Bullion Trader
            </span>
          </a>
          <nav aria-label="Principal" className="hidden gap-8 text-sm text-bt-muted md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-bt-fg">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden text-sm font-semibold sm:block">
              Acessar
            </Link>
            <Link
              href="/auth/sign-up"
              className="bt-gradient rounded-full px-5 py-2 text-sm font-semibold text-bt-fg transition-transform hover:scale-105"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}
