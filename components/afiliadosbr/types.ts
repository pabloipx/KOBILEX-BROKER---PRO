export interface AffiliateInfo {
  id: string
  user_id: string
  code: string
  commission_rate: number
  balance: number
  status: string
  total_earned: number
  total_referrals: number
  referrals_with_deposit: number
}

export interface AffiliateReferral {
  id: string
  referred_user_id: string
  status: string
  total_deposits: number
  total_commission: number
  created_at: string
  profiles?: {
    full_name?: string | null
    email?: string | null
  }
}

export interface AffiliateWithdrawal {
  id: string
  amount: number
  fee: number
  net_amount: number
  pix_key: string
  pix_key_type: string
  status: string
  created_at: string
}

export interface AffiliateData {
  affiliate: AffiliateInfo | null
  referrals: AffiliateReferral[]
  withdrawals: AffiliateWithdrawal[]
}

export type AffiliateSection =
  | "stats-general"
  | "stats-clients"
  | "offers"
  | "payments"
  | "competition"
  | "sub-affiliate"
  | "postbacks"
  | "account"

export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0)

export const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
