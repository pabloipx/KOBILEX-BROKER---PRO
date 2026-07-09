"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import { CheckCircle2, User, Mail, Phone, Lock, ArrowRight, Loader2, X } from "lucide-react"

function SignUpForm() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [referralCode, setReferralCode] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get("ref")
    if (ref) {
      setReferralCode(ref.toUpperCase())
    }
  }, [searchParams])

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 2) return `(${numbers}`
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    if (formatted.length <= 16) setPhone(formatted)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (!acceptTerms) {
      setError("Você precisa aceitar os termos e condições")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      setIsLoading(false)
      return
    }

    try {
      // Call server-side API that creates user with auto-confirmed email
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, phone, referralCode }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Erro ao criar conta")
      }

      // User is created and confirmed - now sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error("[v0] Sign-in error:", signInError)
        throw new Error("Conta criada, mas houve erro ao entrar. Tente fazer login.")
      }

      setSuccess(true)

      setTimeout(() => {
        router.push("/trade")
      }, 2000)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Erro ao criar conta"
      if (errMsg.includes("already registered")) {
        setError("Este e-mail já está cadastrado")
      } else {
        setError(errMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: "#0B0F14" }}>
        <div className="text-center px-6 animate-in fade-in zoom-in duration-500">
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(147, 51, 234, 0.2)" }}
          >
            <CheckCircle2 className="w-12 h-12" style={{ color: "#9333ea" }} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Conta criada com sucesso!</h1>
          <p className="text-gray-400 mb-6">Você será redirecionado para a plataforma...</p>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#9333ea" }} />
            <span style={{ color: "#9333ea" }}>Entrando...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#0B0F14" }}>
      {showTerms && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: "#1a2332" }}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#2a3442" }}>
              <h2 className="text-lg font-bold text-white">Termos e Condições de Uso</h2>
              <button
                onClick={() => setShowTerms(false)}
                className="p-2 rounded-full hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-gray-300 text-sm leading-relaxed space-y-4">
              <p className="text-xs text-gray-500">Última atualização: Janeiro de 2026</p>

              <p>
                Ao acessar, cadastrar-se ou utilizar a plataforma Kodilex Broker, o usuário declara que leu, compreendeu e
                concorda integralmente com os presentes Termos e Condições.
              </p>

              <h3 className="text-white font-semibold pt-2">1. DEFINIÇÕES</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Kodilex Broker:</strong> Plataforma digital para operações em opções binárias.
                </li>
                <li>
                  <strong>Usuário:</strong> Pessoa física que acessa ou utiliza a plataforma.
                </li>
                <li>
                  <strong>Conta:</strong> Cadastro individual do usuário na plataforma.
                </li>
              </ul>

              <h3 className="text-white font-semibold pt-2">2. ACEITAÇÃO DOS TERMOS</h3>
              <p>O uso da plataforma está condicionado à aceitação integral destes Termos e Condições.</p>

              <h3 className="text-white font-semibold pt-2">3. ELEGIBILIDADE</h3>
              <p>A utilização é exclusiva para pessoas maiores de 18 anos.</p>

              <h3 className="text-white font-semibold pt-2">4. CADASTRO</h3>
              <p>O usuário compromete-se a fornecer informações verdadeiras e completas.</p>

              <h3 className="text-white font-semibold pt-2">5. VERIFICAÇÃO KYC</h3>
              <p>A Kodilex Broker poderá solicitar documentos para verificação de identidade. Prazo de até 24 horas.</p>

              <h3 className="text-white font-semibold pt-2">6. DEPÓSITOS</h3>
              <p>Valor mínimo: R$ 50,00. Processamento instantâneo via PIX.</p>

              <h3 className="text-white font-semibold pt-2">7. SAQUES</h3>
              <p>Valor mínimo: R$ 10,00. Prazo de até 24 horas para primeiro saque.</p>

              <h3 className="text-white font-semibold pt-2">8. RISCOS</h3>
              <p>Operações financeiras envolvem riscos e podem resultar em perdas. A Kodilex Broker não garante lucros.</p>

              <h3 className="text-white font-semibold pt-2">9. ACEITE FINAL</h3>
              <p>Ao marcar o checkbox, o usuário declara que leu, é maior de 18 anos e concorda com todas as regras.</p>
            </div>

            <div className="p-4 border-t" style={{ borderColor: "#2a3442" }}>
              <Button
                onClick={() => setShowTerms(false)}
                className="w-full h-12 rounded-xl text-white font-semibold"
                style={{ backgroundColor: "#9333ea" }}
              >
                Li e Entendi
              </Button>
            </div>
          </div>
        </div>
      )}

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

      <div className="px-5 pt-2 pb-4">
        <h1 className="text-2xl font-bold text-white mb-1">Crie sua conta</h1>
        <p className="text-gray-400 text-sm">Comece a operar em menos de 1 minuto</p>
      </div>

      <div className="px-5 pb-8">
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" style={{ color: "#9333ea" }} />
              Nome completo
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Digite seu nome"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="text-white placeholder:text-gray-500 h-12 rounded-xl border-0 focus:ring-2"
              style={{ backgroundColor: "#1a2332", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}
            />
          </div>

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
              className="text-white placeholder:text-gray-500 h-12 rounded-xl border-0 focus:ring-2"
              style={{ backgroundColor: "#1a2332", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-white text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" style={{ color: "#9333ea" }} />
              Telefone
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(99) 99999-9999"
              required
              value={phone}
              onChange={handlePhoneChange}
              className="text-white placeholder:text-gray-500 h-12 rounded-xl border-0 focus:ring-2"
              style={{ backgroundColor: "#1a2332", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white text-sm font-medium flex items-center gap-2">
              <Lock className="w-4 h-4" style={{ color: "#9333ea" }} />
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-white placeholder:text-gray-500 h-12 rounded-xl border-0 focus:ring-2"
              style={{ backgroundColor: "#1a2332", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}
            />
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="terms"
              checked={acceptTerms}
              onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
              className="mt-0.5 rounded"
              style={{
                borderColor: acceptTerms ? "#9333ea" : "#374151",
                backgroundColor: acceptTerms ? "#9333ea" : "transparent",
              }}
            />
            <label htmlFor="terms" className="text-gray-400 text-sm leading-relaxed">
              Tenho mais de 18 anos e concordo com os{" "}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="underline underline-offset-2 hover:opacity-80"
                style={{ color: "#9333ea" }}
              >
                Termos & Condições
              </button>
            </label>
          </div>

          {error && (
            <div
              className="text-sm p-3 rounded-xl flex items-center gap-2"
              style={{ color: "#EF4444", backgroundColor: "rgba(239, 68, 68, 0.1)" }}
            >
              <span className="text-red-500">⚠</span>
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full text-white h-14 rounded-xl font-semibold text-base mt-4 transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: "#9333ea", boxShadow: "0 4px 14px rgba(147, 51, 234, 0.4)" }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Criando conta...
              </>
            ) : (
              <>
                Criar conta grátis
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>

          <p className="text-center text-gray-400 text-sm pt-4">
            Já tem uma conta?{" "}
            <Link href="/auth/login" className="font-semibold" style={{ color: "#9333ea" }}>
              Faça login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default SignUpForm
