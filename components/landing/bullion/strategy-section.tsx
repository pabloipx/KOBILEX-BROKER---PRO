import { cn } from "@/lib/utils"
import { PrimaryButton } from "./primary-button"
import { Reveal } from "./reveal"

const ORDERS = [
  { label: "Entrada de compra", value: "$100", expiry: "5 min", action: "Comprar", tone: "bg-bt-success text-bt-bg" },
  { label: "Entrada de venda", value: "$432", expiry: "10 min", action: "Vender", tone: "bg-bt-danger text-bt-fg" },
]

export function StrategySection() {
  return (
    <section className="py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
        <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1">
          {ORDERS.map((order, i) => (
            <Reveal key={order.label} delay={i * 150}>
              <div
                className={cn(
                  "bt-glass rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1",
                  i === 1 && "sm:mt-10",
                )}
              >
                <p className="text-sm text-bt-muted">{order.label}</p>
                <p className="mt-2 font-bt-display text-3xl font-bold">{order.value}</p>
                <p className="mt-1 text-sm text-bt-muted">Expiração: {order.expiry}</p>
                <div
                  className={cn(
                    "mt-6 rounded-full py-2.5 text-center font-semibold transition-transform hover:scale-105",
                    order.tone,
                  )}
                >
                  {order.action}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="order-1 lg:order-2">
          <h2 className="font-bt-display text-3xl font-bold text-balance md:text-5xl">
            Simplifique sua <span className="bt-text-gradient bt-animate-shine">estratégia de trading.</span>
          </h2>
          <p className="mt-6 leading-relaxed text-bt-muted">
            Abra uma posição de compra ou venda e, se após o tempo escolhido o ativo se mover a seu favor, você recebe
            seus lucros imediatamente.
          </p>
          <div className="mt-8">
            <PrimaryButton href="/auth/sign-up">Começar agora</PrimaryButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
