"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Camera,
  ChevronDown,
  Copy,
  Check,
  SquarePen,
  CirclePlus,
  DollarSign,
  CircleHelp,
  RefreshCw,
  History,
  Settings,
  LogOut,
} from "lucide-react"

type Props = {
  email: string
  createdAt?: string
  userId: string
  progress: number
  onSignOut: () => void
}

const RING = 2 * Math.PI * 21

const MENU = [
  { href: "/profile", label: "Enviar uma foto", icon: Camera },
  { href: "/profile", label: "Dados pessoais", icon: SquarePen },
  { href: "/deposit", label: "Depositar fundos", icon: CirclePlus },
  { href: "/withdraw", label: "Retirar fundos", icon: DollarSign },
  { href: "/suporte", label: "Contactar o suporte", icon: CircleHelp },
  { href: "/transactions", label: "Histórico do saldo", icon: RefreshCw },
  { href: "/historico", label: "Histórico de trading", icon: History },
  { href: "/settings", label: "Definições", icon: Settings },
] as const

function ProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r="21" fill="none" className="stroke-tr-line" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r="21"
          fill="none"
          className="stroke-tr-fg"
          strokeWidth="3"
          strokeDasharray={`${(progress / 100) * RING} ${RING}`}
        />
      </svg>
      <span className="text-xs text-tr-fg">{progress}%</span>
    </span>
  )
}

export function TraderoomProfileMenu({ email, createdAt, userId, progress, onSignOut }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const shortId = userId.replace(/-/g, "").slice(0, 9).toUpperCase()
  const registered = createdAt
    ? new Date(createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }).replace(".", "").replace(/ de /g, " ")
    : "—"

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu do perfil"
        className="flex items-center gap-2 text-tr-muted hover:text-tr-fg"
      >
        <ProgressRing progress={progress} />
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="fixed right-[126px] top-[71px] z-50 flex w-[520px] bg-tr-raised shadow-2xl" role="menu">
            <div className="flex w-[290px] flex-col gap-5 p-5">
              <p className="truncate text-sm text-tr-muted">{email}</p>
              {progress < 100 && (
                <Link
                  href="/help"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 bg-tr-line/40 p-3 hover:bg-tr-line/70 transition-colors"
                >
                  <ProgressRing progress={progress} size={44} />
                  <span className="text-sm leading-snug text-tr-fg">Concluir a visita à sua primeira negociação</span>
                </Link>
              )}
              <div className="h-px bg-tr-line" />
              <p className="flex items-center gap-2 text-sm text-tr-muted">
                <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-tr-up" aria-hidden="true">
                  <span className="h-2 w-2 rotate-45 bg-tr-warn" />
                </span>
                Brasil
              </p>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex flex-col gap-1">
                  <dt className="text-[11px] text-tr-muted">Data de registro</dt>
                  <dd className="text-tr-fg">{registered}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-[11px] text-tr-muted">ID do usuário</dt>
                  <dd className="flex items-center gap-2 text-tr-fg tabular-nums">
                    {shortId}
                    <button
                      type="button"
                      onClick={copyId}
                      aria-label="Copiar ID do usuário"
                      className="text-tr-muted hover:text-tr-fg"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-tr-up" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </dd>
                </div>
              </dl>
            </div>

            <nav className="flex flex-1 flex-col py-3 pr-4">
              {MENU.map(({ href, label, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-1.5 text-sm text-tr-fg hover:bg-tr-line/50 transition-colors"
                >
                  <Icon className="w-4 h-4 text-tr-muted" aria-hidden="true" />
                  {label}
                </Link>
              ))}
              <div className="my-2 h-px bg-tr-line" />
              <button
                type="button"
                role="menuitem"
                onClick={onSignOut}
                className="flex items-center gap-3 px-3 py-1.5 text-left text-sm text-tr-fg hover:bg-tr-line/50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-tr-muted" aria-hidden="true" />
                Sair
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
