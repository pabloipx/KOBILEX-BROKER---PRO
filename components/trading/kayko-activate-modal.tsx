"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import { X, Loader2, Lock, CheckCircle, Eye, EyeOff, Wallet } from "lucide-react"

interface Eligibility {
  eligible: boolean
  totalDeposited?: number
  minDeposit?: number
  missing?: number
  error?: string
}

const eligibilityFetcher = async (url: string): Promise<Eligibility> => {
  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json().catch(() => null)
  return data ?? { eligible: false, error: "Erro ao verificar sua conta" }
}

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

interface KaykoActivateModalProps {
  isOpen: boolean
  onClose: () => void
  onActivated: () => void
}

type Step = "password" | "activating" | "success"

const ACCENT = "#22d3ee"

export function KaykoActivateModal({ isOpen, onClose, onActivated }: KaykoActivateModalProps) {
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const {
    data: eligibility,
    isLoading: checkingEligibility,
    mutate: recheckEligibility,
  } = useSWR(isOpen ? "/api/kayko/validate" : null, eligibilityFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  })

  const reset = useCallback(() => {
    setStep("password")
    setPassword("")
    setShowPassword(false)
    setError("")
    setIsLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleActivate = useCallback(async () => {
    if (!password.trim()) {
      setError("Digite a senha do robô")
      return
    }
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/kayko/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setError(data?.error || "Senha incorreta")
        setIsLoading(false)
        return
      }
      setIsLoading(false)
      setStep("activating")
      window.setTimeout(() => {
        setStep("success")
        window.setTimeout(() => {
          onActivated()
          handleClose()
        }, 1400)
      }, 1800)
    } catch {
      setError("Erro ao validar. Tente novamente.")
      setIsLoading(false)
    }
  }, [password, onActivated, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/5"
        style={{ backgroundColor: "#0a0e13" }}
      >
        {/* Header */}
        <div className="relative p-5 border-b border-white/5" style={{ background: `linear-gradient(135deg, ${ACCENT}1f 0%, #0a0e13 70%)` }}>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl overflow-hidden ring-2"
              style={{ boxShadow: `0 0 16px ${ACCENT}55`, borderColor: ACCENT }}
            >
              <img src="/images/kayko-robot.png" alt="Robô TRADER PRO" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg tracking-wide">
                <span style={{ color: ACCENT }}>TRADER PRO</span>
              </h2>
              <p className="text-white/40 text-xs">Analisador de entradas</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {step === "password" && (checkingEligibility || !eligibility) && (
            <div className="text-center py-8" role="status">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" style={{ color: ACCENT }} />
              <p className="text-white/70 text-sm">Verificando sua conta...</p>
            </div>
          )}

          {step === "password" && !checkingEligibility && eligibility && !eligibility.eligible && (
            <div className="space-y-5">
              <div className="text-center">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${ACCENT}22` }}
                >
                  <Wallet className="w-8 h-8" style={{ color: ACCENT }} />
                </div>
                <h3 className="text-white font-bold text-base text-balance">
                  {eligibility.error && eligibility.totalDeposited === undefined
                    ? eligibility.error
                    : "Disponível a partir de R$ 250,00 depositados"}
                </h3>
                {eligibility.totalDeposited !== undefined && (
                  <p className="text-white/50 text-sm mt-2 text-pretty">
                    Faça um depósito para liberar o TRADER PRO na sua conta.
                  </p>
                )}
              </div>

              {eligibility.totalDeposited !== undefined && (
                <div className="rounded-2xl border border-white/5 bg-[#121826] p-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-white/50">Depositado</span>
                    <span className="text-white font-semibold">
                      {formatBRL(eligibility.totalDeposited)} / {formatBRL(eligibility.minDeposit ?? 250)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (eligibility.totalDeposited / (eligibility.minDeposit ?? 250)) * 100)}%`,
                        background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`,
                      }}
                    />
                  </div>
                  <p className="text-xs mt-3" style={{ color: ACCENT }}>
                    Faltam {formatBRL(eligibility.missing ?? 0)}
                  </p>
                </div>
              )}

              <Link
                href="/deposit"
                onClick={handleClose}
                className="w-full py-3.5 text-[#04121a] font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`, boxShadow: `0 8px 24px ${ACCENT}44` }}
              >
                <Wallet className="w-5 h-5" />
                Fazer depósito
              </Link>
              <button
                type="button"
                onClick={() => recheckEligibility()}
                className="w-full text-white/50 hover:text-white/80 text-sm transition"
              >
                Já depositei, verificar de novo
              </button>
            </div>
          )}

          {step === "password" && !checkingEligibility && eligibility?.eligible && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${ACCENT}22` }}
                >
                  <Lock className="w-8 h-8" style={{ color: ACCENT }} />
                </div>
                <p className="text-white/70 text-sm">Digite a senha do robô para ativá-lo na tela de trade.</p>
                <p className="text-xs mt-2" style={{ color: ACCENT }}>Conta liberada para o TRADER PRO.</p>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError("")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleActivate()
                  }}
                  placeholder="Senha do robô"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 pr-12 text-base bg-[#121826] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none transition"
                  style={{ caretColor: ACCENT }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {error && <p className="text-[#EF4444] text-sm text-center">{error}</p>}

              <button
                onClick={handleActivate}
                disabled={isLoading}
                className="w-full py-3.5 text-[#04121a] font-bold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`, boxShadow: `0 8px 24px ${ACCENT}44` }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Ativar robô"
                )}
              </button>
            </div>
          )}

          {step === "activating" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: `${ACCENT}33` }} />
                <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
                <img src="/images/kayko-robot.png" alt="TRADER PRO" className="absolute inset-2 rounded-full object-cover" />
              </div>
              <p className="text-white font-medium text-lg animate-pulse">Ativando o TRADER PRO...</p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8">
              <div
                className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center animate-in zoom-in duration-500"
                style={{ backgroundColor: `${ACCENT}22` }}
              >
                <CheckCircle className="w-12 h-12" style={{ color: ACCENT }} />
              </div>
              <p className="font-bold text-lg" style={{ color: ACCENT }}>
                Robô ativado com sucesso!
              </p>
              <p className="text-white/50 text-sm mt-1">Abra a tela de trade para ver o robô.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
