import type { SupabaseClient } from "@supabase/supabase-js"

export type CommissionModel = "revshare" | "cpa" | "hybrid"

export interface AffiliateGlobalSettings {
  default_revshare_percent: number
  default_cpa_amount: number
  cpa_min_deposit: number
  sub_affiliate_percent: number
  min_withdrawal: number
  withdrawal_fee_percent: number
  program_enabled: boolean
  auto_approve_affiliates: boolean
  updated_at: string | null
}

export const FALLBACK_SETTINGS: AffiliateGlobalSettings = {
  default_revshare_percent: 77,
  default_cpa_amount: 100,
  cpa_min_deposit: 50,
  sub_affiliate_percent: 5,
  min_withdrawal: 250,
  withdrawal_fee_percent: 2,
  program_enabled: true,
  auto_approve_affiliates: true,
  updated_at: null,
}

const num = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Carrega as configurações globais do programa, caindo para os padrões quando ausentes. */
export async function getAffiliateSettings(supabase: SupabaseClient): Promise<AffiliateGlobalSettings> {
  const { data } = await supabase.from("affiliate_global_settings").select("*").eq("id", 1).maybeSingle()

  if (!data) return FALLBACK_SETTINGS

  return {
    default_revshare_percent: num(data.default_revshare_percent, FALLBACK_SETTINGS.default_revshare_percent),
    default_cpa_amount: num(data.default_cpa_amount, FALLBACK_SETTINGS.default_cpa_amount),
    cpa_min_deposit: num(data.cpa_min_deposit, FALLBACK_SETTINGS.cpa_min_deposit),
    sub_affiliate_percent: num(data.sub_affiliate_percent, FALLBACK_SETTINGS.sub_affiliate_percent),
    min_withdrawal: num(data.min_withdrawal, FALLBACK_SETTINGS.min_withdrawal),
    withdrawal_fee_percent: num(data.withdrawal_fee_percent, FALLBACK_SETTINGS.withdrawal_fee_percent),
    program_enabled: data.program_enabled !== false,
    auto_approve_affiliates: data.auto_approve_affiliates !== false,
    updated_at: data.updated_at ?? null,
  }
}

export interface AffiliateTerms {
  model: CommissionModel
  revsharePercent: number
  cpaAmount: number
  cpaMinDeposit: number
  subPercent: number
}

/** Resolve os termos efetivos de um afiliado, usando os padrões globais como fallback. */
export function resolveTerms(
  profile: {
    affiliate_commission_percent?: number | null
    affiliate_cpa_amount?: number | null
    affiliate_commission_model?: string | null
    affiliate_cpa_min_deposit?: number | null
    affiliate_sub_percent?: number | null
  },
  settings: AffiliateGlobalSettings,
): AffiliateTerms {
  const rawModel = profile.affiliate_commission_model
  const model: CommissionModel =
    rawModel === "revshare" || rawModel === "cpa" || rawModel === "hybrid" ? rawModel : "hybrid"

  return {
    model,
    revsharePercent: num(profile.affiliate_commission_percent, settings.default_revshare_percent),
    cpaAmount: num(profile.affiliate_cpa_amount, settings.default_cpa_amount),
    cpaMinDeposit: num(profile.affiliate_cpa_min_deposit, settings.cpa_min_deposit),
    subPercent: num(profile.affiliate_sub_percent, settings.sub_affiliate_percent),
  }
}

export interface CommissionBreakdown {
  total: number
  revshareAmount: number
  cpaAmount: number
  /** Modelo efetivamente aplicado neste depósito */
  appliedModel: CommissionModel
}

/**
 * Calcula a comissão de um depósito.
 * - revshare: percentual sobre todos os depósitos
 * - cpa: valor fixo, apenas no primeiro depósito que atinge o mínimo
 * - hybrid: CPA no primeiro depósito qualificado + RevShare em todos
 */
export function calculateCommission(
  depositAmount: number,
  terms: AffiliateTerms,
  options: { isFirstQualifiedDeposit: boolean },
): CommissionBreakdown {
  const amount = num(depositAmount, 0)
  const qualifiesForCpa = options.isFirstQualifiedDeposit && amount >= terms.cpaMinDeposit

  const revshareAmount =
    terms.model === "revshare" || terms.model === "hybrid" ? amount * (terms.revsharePercent / 100) : 0

  const cpaAmount = (terms.model === "cpa" || terms.model === "hybrid") && qualifiesForCpa ? terms.cpaAmount : 0

  return {
    total: round2(revshareAmount + cpaAmount),
    revshareAmount: round2(revshareAmount),
    cpaAmount: round2(cpaAmount),
    appliedModel: terms.model,
  }
}

export function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

/**
 * Verifica se este é o primeiro depósito do referido que gera CPA.
 * Um CPA por usuário referido.
 */
export async function isFirstCpaForReferral(
  supabase: SupabaseClient,
  affiliateId: string,
  referredUserId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("affiliate_commissions")
    .select("id")
    .eq("affiliate_id", affiliateId)
    .eq("referred_user_id", referredUserId)
    .gt("cpa_amount", 0)
    .limit(1)

  return !data || data.length === 0
}
