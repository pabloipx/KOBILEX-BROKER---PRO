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
  CircleHelp,
  Bell,
  type LucideIcon,
} from "lucide-react"
import type { NavConfigEntry } from "./use-nav-config"

export type NavItemId =
  | "portfolio"
  | "history"
  | "chat"
  | "tournaments"
  | "leaders"
  | "promo"
  | "tutorials"
  | "analysis"
  | "help"
  | "alerts"

export type TraderoomPanel = NavItemId | "more"

export type NavItem = { id: NavItemId; label: string; menuLabel: string; icon: LucideIcon; badge?: number }

export const NAV_ITEMS: Record<NavItemId, NavItem> = {
  portfolio: { id: "portfolio", label: "Portfólio total", menuLabel: "Portfólio", icon: Briefcase },
  history: { id: "history", label: "Histórico de trading", menuLabel: "Histórico de trading", icon: History },
  chat: { id: "chat", label: "Chats e suporte", menuLabel: "Chats e Suporte", icon: MessagesSquare },
  tournaments: { id: "tournaments", label: "Torneios", menuLabel: "Torneios", icon: Trophy },
  leaders: { id: "leaders", label: "Tabela de líderes", menuLabel: "Tabela de líderes", icon: Award },
  promo: { id: "promo", label: "Promoção", menuLabel: "Promoção", icon: Megaphone, badge: 1 },
  tutorials: { id: "tutorials", label: "Tutoriais", menuLabel: "Tutoriais", icon: GraduationCap },
  analysis: { id: "analysis", label: "Análise de mercado", menuLabel: "Análise de Mercado", icon: Newspaper },
  help: { id: "help", label: "Ajuda", menuLabel: "Ajuda", icon: CircleHelp },
  alerts: { id: "alerts", label: "Alertas", menuLabel: "Alertas", icon: Bell },
}

type Props = {
  active: TraderoomPanel | null
  portfolioOpen: boolean
  config: NavConfigEntry[]
  alertCount?: number
  onSelect: (id: NavItemId) => void
  onMore: () => void
}

function NavButton({
  label,
  icon: Icon,
  badge,
  active,
  onClick,
}: {
  label: string
  icon: LucideIcon
  badge?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex flex-col items-center justify-center gap-1.5 px-1 py-2 min-h-[72px] shrink-0 text-center transition-colors ${
        active ? "bg-tr-raised text-tr-fg" : "text-tr-muted hover:text-tr-fg hover:bg-tr-raised/50"
      }`}
    >
      <span className="relative">
        <Icon className="w-6 h-6" strokeWidth={1.75} aria-hidden="true" />
        {badge ? (
          <span className="absolute -top-1.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-tr-brand text-[9px] font-bold text-tr-fg">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] uppercase leading-tight tracking-tight text-balance">{label}</span>
    </button>
  )
}

export function TraderoomNav({ active, portfolioOpen, config, alertCount = 0, onSelect, onMore }: Props) {
  return (
    <nav
      aria-label="Menu da sala de trading"
      className="hidden lg:flex w-[75px] shrink-0 flex-col border-r border-tr-line bg-tr-rail overflow-y-auto scrollbar-hide"
    >
      {config
        .filter((entry) => entry.visible)
        .map(({ id }) => {
          const item = NAV_ITEMS[id]
          return (
            <NavButton
              key={id}
              label={item.label}
              icon={item.icon}
              badge={id === "alerts" ? alertCount || undefined : item.badge}
              active={id === "portfolio" ? portfolioOpen && !active : active === id}
              onClick={() => onSelect(id)}
            />
          )
        })}
      <NavButton label="Mais" icon={MoreHorizontal} active={active === "more"} onClick={onMore} />
    </nav>
  )
}
