"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft, Loader2, ShieldCheck, Copy, Check, Trash2 } from "lucide-react"
import Image from "next/image"

interface Props {
  onBack: () => void
}

type Factor = { id: string; friendly_name?: string | null; status: string }

export function TwoFactor({ onBack }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [factors, setFactors] = useState<Factor[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fluxo de inscrição (enroll)
  const [enrolling, setEnrolling] = useState(false)
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)

  const activeFactor = factors.find((f) => f.status === "verified")

  const loadFactors = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) setError(error.message)
    else setFactors((data?.totp || []) as Factor[])
    setLoading(false)
  }

  useEffect(() => {
    loadFactors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startEnroll = async () => {
    setError(null)
    setEnrolling(true)
    // Limpa fatores nao verificados que possam ter sobrado de tentativas anteriores.
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.totp || []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" })
    if (error) {
      setError(error.message)
      setEnrolling(false)
      return
    }
    setFactorId(data.id)
    setQrSvg(data.totp.qr_code)
    setSecret(data.totp.secret)
  }

  const verifyEnroll = async () => {
    if (!factorId || code.length < 6) return
    setVerifying(true)
    setError(null)
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
    if (cErr) {
      setError(cErr.message)
      setVerifying(false)
      return
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })
    if (vErr) {
      setError("Código inválido. Verifique o app autenticador e tente novamente.")
      setVerifying(false)
      return
    }
    // Sucesso: reseta o fluxo e recarrega a lista.
    setEnrolling(false)
    setQrSvg(null)
    setSecret(null)
    setFactorId(null)
    setCode("")
    setVerifying(false)
    await loadFactors()
  }

  const disable = async (id: string) => {
    setError(null)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
    if (error) setError(error.message)
    else await loadFactors()
  }

  const copySecret = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
        <button onClick={onBack} className="p-2 -ml-2" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Verificação em duas etapas</h1>
      </div>

      <div className="px-4 py-6 max-w-xl mx-auto space-y-5">
        {error && (
          <div className="text-sm p-3 rounded-lg text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-[#9333ea] animate-spin" />
          </div>
        ) : activeFactor ? (
          // ===== 2FA ATIVO =====
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[#0f2318] border border-[#1b5e20]/40">
              <ShieldCheck className="w-6 h-6 text-[#00E676] shrink-0" />
              <div>
                <p className="text-white font-semibold">Verificação em duas etapas ativa</p>
                <p className="text-sm text-[#9CA3AF] mt-0.5">
                  Sua conta está protegida com um código do aplicativo autenticador.
                </p>
              </div>
            </div>
            <button
              onClick={() => disable(activeFactor.id)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Desativar verificação em duas etapas
            </button>
          </div>
        ) : enrolling && qrSvg ? (
          // ===== FLUXO DE ATIVAÇÃO =====
          <div className="space-y-5">
            <div>
              <p className="text-white font-semibold mb-1">1. Escaneie o QR Code</p>
              <p className="text-sm text-[#9CA3AF] mb-3">
                Abra seu app autenticador (Google Authenticator, Authy, etc.) e escaneie o código abaixo.
              </p>
              <div className="flex justify-center">
                <div
                  className="bg-white p-3 rounded-xl w-[200px] h-[200px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              </div>
            </div>

            {secret && (
              <div>
                <p className="text-sm text-[#9CA3AF] mb-2">Ou insira esta chave manualmente:</p>
                <button
                  onClick={copySecret}
                  className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-[#121826] border border-[#1F2933] text-left"
                >
                  <code className="text-sm text-white break-all font-mono">{secret}</code>
                  {copied ? (
                    <Check className="w-4 h-4 text-[#00E676] shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                  )}
                </button>
              </div>
            )}

            <div>
              <p className="text-white font-semibold mb-2">2. Digite o código de 6 dígitos</p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="000000"
                className="w-full py-3 px-4 rounded-xl text-white text-center text-2xl tracking-[0.5em] font-mono bg-[#121826] border border-[#1F2933] focus:border-[#9333ea] outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEnrolling(false)
                  setQrSvg(null)
                  setCode("")
                }}
                className="flex-1 py-3 rounded-xl text-white bg-[#1A2332] hover:bg-[#243040] transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={verifyEnroll}
                disabled={code.length < 6 || verifying}
                className="flex-1 py-3 rounded-xl text-white bg-[#9333ea] hover:bg-[#7e22ce] transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                Ativar
              </button>
            </div>
          </div>
        ) : (
          // ===== ESTADO INICIAL (DESATIVADO) =====
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
              <div className="w-10 h-10 rounded-lg bg-[#9333ea]/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#9333ea]" />
              </div>
              <div>
                <p className="text-white font-semibold">Adicione uma camada extra de segurança</p>
                <p className="text-sm text-[#9CA3AF] mt-0.5">
                  Ao ativar, além da senha você precisará de um código gerado pelo seu app autenticador para entrar.
                </p>
              </div>
            </div>
            <button
              onClick={startEnroll}
              className="w-full py-3 rounded-xl text-white bg-[#9333ea] hover:bg-[#7e22ce] transition-colors font-semibold"
            >
              Ativar verificação em duas etapas
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
