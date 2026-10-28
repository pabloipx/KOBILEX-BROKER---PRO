"use client"

import {
  Briefcase,
  History,
  MessagesSquare,
  Trophy,
  Award,
  Megaphone,
  GraduationCap,
  Newspaper,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react"

export type TraderoomPanel =
  | "portfolio"
  | "history"
  | "chat"
  | "tournaments"
  | "leaders"
  | "promo"
  | "tutorials"
  | "analysis"

type NavItem = { id: TraderoomPanel | "more"; label: string; icon: LucideIcon; badge?: number }

const ITEMS: NavItem[] = [
  { id: "portfolio", label: "Portfólio total", icon: Briefcase },
  { id: "history", label: "Histórico de trading", icon: History },
  { id: "chat", label: "Chats e suporte", icon: MessagesSquare },
  { id: "tournaments", label: "Torneios", icon: Trophy },
  { id: "leaders", label: "Tabela de líderes", icon: Award },
  { id: "promo", label: "Promoção", icon: Megaphone, badge: 1 },
  { id: "tutorials", label: "Tutoriais", icon: GraduationCap },
  { id: "analysis", label: "Análise de mercado", icon: Newspaper },
  { id: "more", label: "Mais", icon: MoreHorizontal },
]

type Props = {
  active: TraderoomPanel | null
  portfolioOpen: boolean
  onSelect: (id: TraderoomPanel) => void
  onMore: () => void
}

export function TraderoomNav({ active, portfolioOpen, onSelect, onMore }: Props) {
  return (
    <nav
      aria-label="Menu da sala de trading"
      className="hidden lg:flex w-[75px] shrink-0 flex-col border-r border-tr-line bg-tr-rail overflow-y-auto scrollbar-hide"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = item.id === "portfolio" ? portfolioOpen && !active : active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => (item.id === "more" ? onMore() : onSelect(item.id))}
            aria-pressed={item.id === "more" ? undefined : isActive}
            className={`relative flex flex-col items-center justify-center gap-1.5 px-1 py-2 min-h-[72px] shrink-0 text-center transition-colors ${
              isActive ? "bg-tr-raised text-tr-fg" : "text-tr-muted hover:text-tr-fg hover:bg-tr-raised/50"
            }`}
          >
            <span className="relative">
              <Icon className="w-6 h-6" strokeWidth={1.75} aria-hidden="true" />
              {item.badge ? (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-tr-brand text-[9px] font-bold text-tr-fg">
                  {item.badge}
                </span>
              ) : null}
            </span>
            <span className="text-[10px] uppercase leading-tight tracking-tight text-balance">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
