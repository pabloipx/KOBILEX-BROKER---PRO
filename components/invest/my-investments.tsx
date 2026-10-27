import { Lock, ShieldCheck, Wallet } from "lucide-react"

export function MyInvestments() {
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="my-investments-title"
        className="rounded-2xl border border-white/10 bg-[#0a1226]/80 p-5"
      >
        <div className="flex items-center gap-3">
          <Wallet className="size-7 text-[#3b9bff]" aria-hidden="true" />
          <h2 id="my-investments-title" className="text-lg font-semibold">
            Seus investimentos
          </h2>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#050a18] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-white/70">Investimento atual</p>
            <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs text-white/70">Nenhum ativo</span>
          </div>
          <p className="mt-1 text-2xl font-bold">US$ 0,00</p>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div>
              <p className="text-sm text-white/70">Rendimento mensal (10%)</p>
              <p className="font-semibold">US$ 0,00</p>
            </div>
            <div>
              <p className="text-sm text-white/70">Próximo saque</p>
              <p className="font-semibold">Dia 30</p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 border-t border-white/10 pt-4">
            <Lock className="size-5 shrink-0 text-white/70" aria-hidden="true" />
            <p className="text-sm text-white/70">
              Valor liberado após 3 meses. Simule ao lado e confirme para começar a render.
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0a1226]/80 p-5">
        <ShieldCheck className="size-8 shrink-0 text-[#3b9bff]" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-[#3b9bff]">Seguro e confiável</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/70">
            Seus investimentos são protegidos por tecnologia de ponta e criptografia, garantindo a segurança do seu
            capital na KOBILEX.
          </p>
        </div>
      </section>
    </div>
  )
}
