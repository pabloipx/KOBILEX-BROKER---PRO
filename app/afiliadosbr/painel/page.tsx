"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AffiliateSidebar } from "@/components/afiliadosbr/affiliate-sidebar"
import { AffiliateTopbar } from "@/components/afiliadosbr/affiliate-topbar"
import { SectionStatsGeneral } from "@/components/afiliadosbr/section-stats-general"
import { SectionStatsClients } from "@/components/afiliadosbr/section-stats-clients"
import { SectionOffers } from "@/components/afiliadosbr/section-offers"
import { SectionPayments } from "@/components/afiliadosbr/section-payments"
import {
  SectionAccount,
  SectionCompetition,
  SectionPostbacks,
  SectionSubAffiliate,
} from "@/components/afiliadosbr/section-basic"
import type { AffiliateData, AffiliateSection } from "@/components/afiliadosbr/types"

function nextPaymentWindow() {
  const now = new Date()
  const month = now.toLocaleDateString("pt-BR", { month: "long" })
  return now.getDate() <= 10 ? `10-12 ${month}` : `25-27 ${month}`
}

export default function AffiliatePanelPage() {
  const router = useRouter()
  const [section, setSection] = useState<AffiliateSection>("stats-general")
  const [email, setEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [data, setData] = useState<AffiliateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate")
      if (res.status === 401) {
        router.replace("/afiliadosbr")
        return
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao carregar dados")
      setData({
        affiliate: json.affiliate ?? null,
        referrals: json.referrals ?? [],
        withdrawals: json.withdrawals ?? [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.replace("/afiliadosbr")
        return
      }
      const user = sessionData.session.user
      setEmail(user.email || "")
      setUserName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Afiliado")
      await loadData()
    }
    init()
  }, [router, loadData])

  const activate = async () => {
    setActivating(true)
    setError(null)
    try {
      const res = await fetch("/api/affiliate", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao ativar conta de afiliado")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ativar conta")
    } finally {
      setActivating(false)
    }
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/afiliadosbr")
  }

  const nextPayment = useMemo(nextPaymentWindow, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!data?.affiliate) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#fafafa] px-4 font-sans">
        <div className="w-full max-w-[480px] rounded-xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-[24px] font-semibold text-gray-900">Ative sua conta de afiliado</h1>
          <p className="mt-2 text-[15px] text-gray-600">
            Sua conta na corretora já está conectada. Ative o programa de afiliados para gerar seu link e acompanhar as
            comissões.
          </p>
          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>
          )}
          <button
            type="button"
            onClick={activate}
            disabled={activating}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 text-[15px] font-semibold text-gray-900 transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            {activating && <Loader2 className="h-4 w-4 animate-spin" />}
            Ativar programa de afiliados
          </button>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 text-[15px] text-gray-500 transition-colors hover:text-gray-800"
          >
            Sair
          </button>
        </div>
      </div>
    )
  }

  const affiliate = data.affiliate

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa] font-sans">
      <AffiliateTopbar userName={userName} balance={affiliate.balance} nextPayment={nextPayment} />

      <div className="flex flex-1">
        <AffiliateSidebar active={section} onChange={setSection} onSignOut={signOut} />

        <main className="flex-1 overflow-x-auto px-8 py-8">
          <div className="mx-auto max-w-[1160px]">
            {error && (
              <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {error}
              </p>
            )}

            {section === "stats-general" && <SectionStatsGeneral referrals={data.referrals} />}
            {section === "stats-clients" && <SectionStatsClients referrals={data.referrals} />}
            {section === "offers" && <SectionOffers affiliate={affiliate} />}
            {section === "payments" && (
              <SectionPayments
                affiliate={affiliate}
                withdrawals={data.withdrawals}
                nextPayment={nextPayment}
                onRefresh={loadData}
              />
            )}
            {section === "competition" && <SectionCompetition affiliate={affiliate} />}
            {section === "sub-affiliate" && <SectionSubAffiliate affiliate={affiliate} />}
            {section === "postbacks" && <SectionPostbacks affiliate={affiliate} />}
            {section === "account" && <SectionAccount affiliate={affiliate} email={email} />}
          </div>
        </main>
      </div>
    </div>
  )
}
