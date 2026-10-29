import type { SupabaseClient } from "@supabase/supabase-js"

// Limites guardados em platform_settings (um mapa userId -> valor maximo por saque) para nao
// exigir migracao de schema na tabela profiles.
const SETTING_KEY = "withdraw_limits"

export const LIMITED_WITHDRAW_COOLDOWN_HOURS = 48

type LimitMap = Record<string, number>

function parseLimits(value: unknown): LimitMap {
  let raw = value
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}

  const limits: LimitMap = {}
  for (const [userId, amount] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(amount)
    if (Number.isFinite(n) && n > 0) limits[userId] = n
  }
  return limits
}

export async function getWithdrawLimits(supabase: SupabaseClient): Promise<LimitMap> {
  const { data } = await supabase
    .from("platform_settings")
    .select("setting_value")
    .eq("setting_key", SETTING_KEY)
    .maybeSingle()
  return parseLimits(data?.setting_value)
}

export async function getUserWithdrawLimit(supabase: SupabaseClient, userId: string): Promise<number | null> {
  const limits = await getWithdrawLimits(supabase)
  return limits[userId] ?? null
}

/** Define (amount > 0) ou remove (amount null) o limite de saque de um usuario. */
export async function setUserWithdrawLimit(supabase: SupabaseClient, userId: string, amount: number | null) {
  const { data: existing, error: readError } = await supabase
    .from("platform_settings")
    .select("id, setting_value")
    .eq("setting_key", SETTING_KEY)
    .maybeSingle()
  if (readError) throw readError

  const limits = parseLimits(existing?.setting_value)
  if (amount === null) delete limits[userId]
  else limits[userId] = Math.round(amount * 100) / 100

  const now = new Date().toISOString()
  const { error } = existing
    ? await supabase.from("platform_settings").update({ setting_value: limits, updated_at: now }).eq("id", existing.id)
    : await supabase.from("platform_settings").insert({
        setting_key: SETTING_KEY,
        setting_value: limits,
        description: "Limite de saque por usuario (admin)",
        is_public: false,
      })
  if (error) throw error
}
