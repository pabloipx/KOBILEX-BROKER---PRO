"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/trade")
      } else {
        setIsCheckingSession(false)
      }
    })
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLoading) return

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedPassword) {
      setError("Preencha todos os campos")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      })

      if (signInError) {
        const msg = signInError.message.toLowerCase()
        if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
          throw new Error("E-mail ou senha incorretos")
        }
        if (msg.includes("email not confirmed")) {
          throw new Error("Confirme seu e-mail antes de entrar")
        }
        if (msg.includes("too many requests")) {
          throw new Error("Muitas tentativas. Aguarde alguns minutos.")
        }
        throw new Error(signInError.message)
      }

      router.push("/trade")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login"
      setError(message)
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: "#0B0F14" }}>
        <div className="w-10 h-10 border-2 border-[#9333ea] border-t-transparent rounded-full animate-spin" />
      </div>
    )
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
        <Link href="/auth/sign-up">
          <Button
            variant="outline"
            className="bg-transparent rounded-full px-6 h-10"
            style={{ borderColor: "#9333ea", color: "#9333ea" }}
          >
            Criar conta
          </Button>
        </Link>
      </header>

      {/* Hero Section */}
      <div className="px-5 pt-8 pb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta</h1>
        <p className="text-gray-400 text-sm">Entre na sua conta para continuar operando</p>
      </div>

      {/* Form */}
      <div className="px-5 pb-8">
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
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

          {/* Senha */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white text-sm font-medium flex items-center gap-2">
              <Lock className="w-4 h-4" style={{ color: "#9333ea" }} />
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
              className="text-white placeholder:text-gray-500 h-12 rounded-xl border-0 focus:ring-2 disabled:opacity-50"
              style={{ backgroundColor: "#1a2332", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}
            />
          </div>

          {/* Forgot Password */}
          <div className="text-right">
            <Link href="/auth/forgot-password" className="text-sm hover:underline" style={{ color: "#9333ea" }}>
              Esqueceu sua senha?
            </Link>
          </div>

          {/* Error */}
          {error && (
            <div
              className="text-sm p-3 rounded-xl flex items-center gap-2"
              style={{ color: "#EF4444", backgroundColor: "rgba(239, 68, 68, 0.1)" }}
            >
              <span className="text-red-500">!</span>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full text-white h-14 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ backgroundColor: "#9333ea", boxShadow: "0 4px 14px rgba(147, 51, 234, 0.4)" }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                Entrar
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>

          {/* Sign Up Link */}
          <p className="text-center text-gray-400 text-sm pt-4">
            Não tem uma conta?{" "}
            <Link href="/auth/sign-up" className="font-semibold" style={{ color: "#9333ea" }}>
              Cadastre-se grátis
            </Link>
          </p>
        </form>

        {/* Trust Badge */}
        <div
          className="mt-8 p-4 rounded-xl"
          style={{ backgroundColor: "rgba(147, 51, 234, 0.1)", border: "1px solid rgba(147, 51, 234, 0.3)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#9333ea" }}
            >
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Conexão Segura</p>
              <p className="text-gray-400 text-xs">Seus dados estão protegidos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
