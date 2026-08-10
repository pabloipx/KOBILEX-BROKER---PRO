"use client"

// ARQUIVO TEMPORARIO DE VERIFICACAO - deve ser apagado apos a validacao.
// Reproduz o painel de afiliados com dados em memoria (sem tocar no banco),
// para clicar em todas as opcoes do menu e conferir que cada secao renderiza.

import { useState } from "react"
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
  SectionTelegramBot,
} from "@/components/afiliadosbr/section-basic"
import { SectionSecurity } from "@/components/afiliadosbr/section-security"
import { SectionProfile } from "@/components/afiliadosbr/section-profile"
import type { AffiliateInfo, AffiliateReferral, AffiliateSection } from "@/components/afiliadosbr/types"
import { DisplayProvider, DEFAULT_DISPLAY } from "@/components/afiliadosbr/currency-context"

const affiliate: AffiliateInfo = {
  id: "aff-1",
  user_id: "user-1",
  code: "TESTE123",
  commission_rate: 40,
  commission_model: "hybrid",
  cpa_amount: 50,
  cpa_min_deposit: 50,
  sub_percent: 5,
  min_withdrawal: 250,
  withdrawal_fee_percent: 0,
  balance: 100,
  status: "active",
  total_earned: 100,
  total_referrals: 3,
  referrals_with_deposit: 3,
}

const referrals: AffiliateReferral[] = [
  {
    id: "r1",
    referred_user_id: "u1",
    status: "active",
    total_deposits: 500,
    total_commission: 60,
    created_at: "2026-08-01T10:00:00Z",
    subid: "instagram",
    profiles: { full_name: "Ana Souza", email: "ana@exemplo.com" },
  },
  {
    id: "r2",
    referred_user_id: "u2",
    status: "active",
    total_deposits: 300,
    total_commission: 30,
    created_at: "2026-08-02T10:00:00Z",
    subid: "youtube",
    profiles: { full_name: "Bruno Lima", email: "bruno@exemplo.com" },
  },
  {
    id: "r3",
    referred_user_id: "u3",
    status: "pending",
    total_deposits: 100,
    total_commission: 10,
    created_at: "2026-08-03T10:00:00Z",
    subid: null,
    profiles: { full_name: "Carla Dias", email: "carla@exemplo.com" },
  },
]

export default function VerifyPanelPage() {
  const [section, setSection] = useState<AffiliateSection>("stats-general")

  return (
    <DisplayProvider value={DEFAULT_DISPLAY}>
      <div className="flex min-h-screen flex-col bg-[#fafafa] font-sans">
        <AffiliateTopbar userName="Afiliado Teste" balance={affiliate.balance} nextPayment="10-12 agosto" />
        <div className="flex flex-1">
          <AffiliateSidebar active={section} onChange={setSection} onSignOut={() => {}} />
          <main className="flex-1 overflow-x-auto px-8 py-8">
            <div className="mx-auto max-w-[1160px]">
              <p className="mb-4 text-sm text-gray-500">
                {"Seção ativa: "}
                {section}
              </p>
              {section === "stats-general" && <SectionStatsGeneral referrals={referrals} />}
              {section === "stats-clients" && <SectionStatsClients referrals={referrals} />}
              {section === "offers" && <SectionOffers affiliate={affiliate} />}
              {section === "payments" && (
                <SectionPayments
                  affiliate={affiliate}
                  withdrawals={[]}
                  nextPayment="10-12 agosto"
                  onRefresh={async () => {}}
                />
              )}
              {section === "competition" && <SectionCompetition affiliate={affiliate} />}
              {section === "sub-affiliate" && <SectionSubAffiliate affiliate={affiliate} />}
              {(section === "postbacks" || section === "postbacks-general") && (
                <SectionPostbacks affiliate={affiliate} />
              )}
              {section === "postbacks-telegram" && <SectionTelegramBot affiliate={affiliate} />}
              {section === "account" && <SectionAccount affiliate={affiliate} email="teste@exemplo.com" />}
              {section === "account-security" && <SectionSecurity email="teste@exemplo.com" />}
              {section === "account-profile" && <SectionProfile />}
            </div>
          </main>
        </div>
      </div>
    </DisplayProvider>
  )
}
