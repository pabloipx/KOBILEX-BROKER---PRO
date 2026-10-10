"use client"

import { ArrowLeft, MessageCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function SupportPage() {
  const router = useRouter()

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold">Suporte</h1>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <MessageCircle className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Atendimento em breve</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Estamos preparando um novo canal de suporte. Volte em breve.
        </p>
        <Button className="mt-2 h-11 px-6" onClick={() => router.push("/trade")}>
          Voltar para o Trade
        </Button>
      </section>
    </main>
  )
}
