import { BarChart3, Bell, Headphones, PlayCircle } from "lucide-react"
import { Reveal } from "./reveal"

const TOOLS = [
  { icon: PlayCircle, title: "Tutoriais em vídeo", desc: "Conceitos básicos, análise técnica e fundamentalista." },
  { icon: BarChart3, title: "Ferramentas avançadas", desc: "Gráficos e indicadores para melhores decisões." },
  { icon: Bell, title: "Alertas de preço", desc: "Não perca o momento certo de comprar ou vender." },
  { icon: Headphones, title: "Suporte 24/7", desc: "Nossa equipe está disponível a qualquer hora." },
]

const TESTIMONIALS = [
  { quote: "Plataforma rápida, gráficos sem atraso e ferramentas de análise que realmente funcionam.", name: "Marcos T." },
  { quote: "Como iniciante, gostei de como tudo é simples. As execuções são instantâneas.", name: "Laura G." },
  { quote: "O suporte me ajudou em todas as dúvidas. Disciplina e calma fazem toda a diferença.", name: "João M." },
]

export function ToolsSection() {
  return (
    <section id="ferramentas" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <h2 className="text-center font-bt-display text-3xl font-bold text-balance md:text-5xl">
            Nós <span className="bt-text-gradient bt-animate-shine">simplificamos</span> tudo que poderia ser complexo.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 120}>
              <div className="bt-glass bt-hover-shadow-glow group h-full rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1">
                <div className="bt-gradient flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                  <Icon className="h-6 w-6 text-bt-fg" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-bt-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-bt-muted">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TestimonialsSection() {
  return (
    <section id="depoimentos" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <h2 className="text-center font-bt-display text-3xl font-bold text-balance md:text-5xl">
            O que dizem nossos clientes
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 120}>
              <figure className="bt-glass h-full rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1">
                <blockquote className="leading-relaxed text-bt-muted">{`“${t.quote}”`}</blockquote>
                <figcaption className="mt-6 font-semibold">{t.name}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
