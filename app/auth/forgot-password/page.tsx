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
    <div className="min-h-screen w-full bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/uryn-fox-logo.png"
            alt="URYNBROKER"
            width={160}
            height={40}
            className="h-9 w-auto"
            unoptimized
          />
        </Link>
        <Link href="/auth/login">
          <Button
            variant="outline"
            className="h-10 rounded-full border-orange-500 bg-transparent px-6 text-orange-600 hover:bg-orange-50 hover:text-orange-600"
          >
            Entrar
          </Button>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md">
        {sent ? (
          /* Success State */
          <div className="px-5 pb-8 pt-12">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-balance text-gray-900">Verifique seu e-mail</h1>
            <p className="text-sm leading-relaxed text-gray-600">
              {"Enviamos um link de recuperação para "}
              <span className="font-medium text-gray-900">{email.trim().toLowerCase()}</span>
              {". Abra o e-mail e clique no link para criar uma nova senha."}
            </p>

            <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs leading-relaxed text-gray-600">
                Não recebeu? Verifique a caixa de spam ou tente novamente em alguns minutos.
              </p>
            </div>

            <Button
              onClick={() => {
                setSent(false)
                setError(null)
              }}
              variant="outline"
              className="mt-6 h-12 w-full rounded-xl border-orange-500 bg-transparent text-orange-600 hover:bg-orange-50 hover:text-orange-600"
            >
              Enviar para outro e-mail
            </Button>

            <Link href="/auth/login" className="block">
              <Button className="mt-3 h-12 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-600">
                Voltar para o login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="px-5 pb-6 pt-8">
              <h1 className="mb-1 text-2xl font-bold text-balance text-gray-900">Esqueceu sua senha?</h1>
              <p className="text-sm leading-relaxed text-gray-600">
                Digite seu e-mail e enviaremos um link para você criar uma nova senha.
              </p>
            </div>

            {/* Form */}
            <div className="px-5 pb-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Mail className="h-4 w-4 text-orange-500" />
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
                    className="h-12 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500/30 disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    <span aria-hidden="true">!</span>
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition-all duration-200 hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar link de recuperação
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>

                <Link
                  href="/auth/login"
                  className="flex items-center justify-center gap-2 pt-4 text-sm text-gray-500 transition-colors hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
