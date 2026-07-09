"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLoading) return

    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) {
      setError("Digite seu e-mail")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) {
        const msg = resetError.message.toLowerCase()
        if (msg.includes("too many requests")) {
          throw new Error("Muitas tentativas. Aguarde alguns minutos.")
        }
        throw new Error(resetError.message)
      }

      setSent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar e-mail de recuperação"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#0B0F14" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/kodilex-logo.png"
            alt="Kodilex Broker"
            width={160}
            height={40}
            className="h-10 w-auto"
            unoptimized
          />
        </Link>
        <Link href="/auth/login">
          <Button
            variant="outline"
            className="bg-transparent rounded-full px-6 h-10"
            style={{ borderColor: "#9333ea", color: "#9333ea" }}
          >
            Entrar
          </Button>
        </Link>
      </header>

      {sent ? (
        /* Success State */
        <div className="px-5 pt-12 pb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: "rgba(0, 230, 118, 0.15)" }}
          >
            <CheckCircle2 className="w-9 h-9" style={{ color: "#00E676" }} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 text-balance">Verifique seu e-mail</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {"Enviamos um link de recuperação para "}
            <span className="text-white font-medium">{email.trim().toLowerCase()}</span>
            {". Abra o e-mail e clique no link para criar uma nova senha."}
          </p>

          <div
            className="mt-6 p-4 rounded-xl"
            style={{ backgroundColor: "rgba(147, 51, 234, 0.1)", border: "1px solid rgba(147, 51, 234, 0.3)" }}
          >
            <p className="text-gray-400 text-xs leading-relaxed">
              Não recebeu? Verifique a caixa de spam ou tente novamente em alguns minutos.
            </p>
          </div>

          <Button
            onClick={() => {
              setSent(false)
              setError(null)
            }}
            variant="outline"
            className="w-full bg-transparent h-12 rounded-xl mt-6"
            style={{ borderColor: "#9333ea", color: "#9333ea" }}
          >
            Enviar para outro e-mail
          </Button>

          <Link href="/auth/login" className="block">
            <Button className="w-full text-white h-12 rounded-xl mt-3" style={{ backgroundColor: "#9333ea" }}>
              Voltar para o login
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <div className="px-5 pt-8 pb-6">
            <h1 className="text-2xl font-bold text-white mb-1 text-balance">Esqueceu sua senha?</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Digite seu e-mail e enviaremos um link para você criar uma nova senha.
            </p>
          </div>

          {/* Form */}
          <div className="px-5 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" style={{ color: "#9333ea" }} />
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Digite seu e-mail"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={isLoading}
                  className="text-white placeholder:text-gray-500 h-12 rounded-xl border-0 focus:ring-2 disabled:opacity-50"
                  style={{ backgroundColor: "#1a2332", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}
                />
              </div>

              {error && (
                <div
                  className="text-sm p-3 rounded-xl flex items-center gap-2"
                  style={{ color: "#EF4444", backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                >
                  <span className="text-red-500">!</span>
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full text-white h-14 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ backgroundColor: "#9333ea", boxShadow: "0 4px 14px rgba(147, 51, 234, 0.4)" }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Enviar link de recuperação
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white pt-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </Link>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
