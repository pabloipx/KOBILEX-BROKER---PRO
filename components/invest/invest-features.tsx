import Image from "next/image"
import { Headset, ShieldCheck, Zap } from "lucide-react"

const FEATURES = [
  { icon: ShieldCheck, title: "Plataforma segura", text: "Com criptografia de nível global." },
  { icon: Headset, title: "Suporte 24/7", text: "Estamos sempre por perto." },
  { icon: Zap, title: "Rendimentos mensais", text: "Receba todo dia 30." },
]

export function InvestFeatures() {
  return (
    <footer className="border-t border-white/10 bg-[#070d1f]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between lg:px-6">
        <ul className="flex flex-col gap-4 md:flex-row md:gap-8">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <Icon className="size-7 shrink-0 text-[#3b9bff]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-white/60">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <Image
          src="/images/kodilex-logo.png"
          alt="KOBILEX"
          width={140}
          height={40}
          className="h-10 w-auto object-contain"
        />
      </div>
    </footer>
  )
}
