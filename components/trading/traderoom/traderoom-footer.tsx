"use client"

import { useState } from "react"
import Link from "next/link"
import { MessageSquareText, HelpCircle, Volume2, VolumeX, Settings, Maximize, Minimize } from "lucide-react"
import { useNow } from "./use-now"

function CurrentTime() {
  const now = useNow(1000)
  const d = new Date(now)
  const date = d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" })
    .replace(" de ", " ")
    .toUpperCase()
  const time = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })
  return (
    <span className="text-tr-muted">
      HORA ATUAL: <span className="text-tr-fg tabular-nums">{`${date}, ${time}`}</span> (UTC-3)
    </span>
  )
}

export function TraderoomFooter() {
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
      setFullscreen(false)
    } else {
      document.documentElement.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {})
    }
  }

  return (
    <footer className="hidden lg:flex h-[30px] shrink-0 items-center justify-between bg-tr-rail pr-4 text-xs">
      <div className="flex h-full items-center gap-4">
        <Link
          href="/suporte"
          className="flex h-full items-center gap-2 bg-tr-down px-3 text-[11px] font-bold uppercase text-tr-fg hover:brightness-110"
        >
          <MessageSquareText className="w-4 h-4" aria-hidden="true" />
          Suporte
        </Link>
        <Link href="/help" className="flex items-center gap-1.5 text-tr-fg hover:underline">
          <HelpCircle className="w-4 h-4 text-tr-muted" aria-hidden="true" />
          Central de ajuda
        </Link>
        <span className="uppercase text-tr-muted">Todo dia, a toda hora</span>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-tr-muted">
          Desenvolvido por <span className="font-bold text-tr-fg">Bullion Trader</span>
        </span>
        <button
          type="button"
          onClick={() => setMuted((v) => !v)}
          aria-label={muted ? "Ativar som" : "Silenciar"}
          className="text-tr-muted hover:text-tr-fg"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <Link href="/settings" aria-label="Configurações" className="text-tr-muted hover:text-tr-fg">
          <Settings className="w-4 h-4" />
        </Link>
        <CurrentTime />
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          className="text-tr-muted hover:text-tr-fg"
        >
          {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </footer>
  )
}
