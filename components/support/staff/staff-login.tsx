"use client"

import { useState } from "react"
import Image from "next/image"
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function StaffLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/support/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Email ou senha incorretos.")
        return
      }
      const check = await fetch("/api/support/staff/conversations?view=active", { cache: "no-store" })
      if (check.status === 401) {
        setError(
          "Login aceito, mas o navegador não guardou o cookie da sessão. Abra o painel em uma aba própria ou libere os cookies deste site.",
        )
        return
      }
      window.location.reload()
    } catch {
      setError("Não foi possível conectar ao servidor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0B0F14] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/images/uryn-fox-logo.png"
            alt="URYNBROKER"
            width={200}
            height={54}
            priority
            className="mx-auto mb-4 h-auto w-[200px]"
          />
          <h1 className="text-2xl font-bold text-white">Central de Atendimento</h1>
          <p className="mt-2 text-sm text-gray-400">Acesso restrito à equipe de suporte e administradores</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <label htmlFor="staff-email" className="sr-only">
              Email
            </label>
            <Mail className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-500" aria-hidden />
            <Input
              id="staff-email"
              type="email"
              autoComplete="username"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 border-[#2A3142] bg-[#1A1F2E] pl-10 text-base text-white placeholder:text-gray-500"
            />
          </div>
          <div className="relative">
            <label htmlFor="staff-password" className="sr-only">
              Senha
            </label>
            <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-500" aria-hidden />
            <Input
              id="staff-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 border-[#2A3142] bg-[#1A1F2E] px-10 text-base text-white placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-0 top-0 flex size-12 items-center justify-center text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-center text-sm text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="h-12 bg-[#f97316] text-base font-semibold text-white hover:bg-[#ea580c]"
          >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  )
}
