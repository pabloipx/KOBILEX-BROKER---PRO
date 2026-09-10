import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Planos válidos (fonte de verdade no servidor)
const PLANS: Record<string, { amount: number; daily: number }> = {
  start: { amount: 500, daily: 5 },
  pro: { amount: 1000, daily: 7 },
  elite: { amount: 5000, daily: 9 },
}

const keyFor = (userId: string) => `ia_broker_state:${userId}`

async function getUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

async function saveState(admin: SupabaseClient, settingKey: string, state: unknown) {
  const value = JSON.stringify(state)
  const { data: existing } = await admin
    .from("platform_settings")
    .select("id")
    .eq("setting_key", settingKey)
    .maybeSingle()

  if (existing?.id) {
    await admin
      .from("platform_settings")
      .update({ setting_value: value, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
  } else {
    await admin.from("platform_settings").insert({
      setting_key: settingKey,
      setting_value: value,
      description: "Estado do Robô de IA por usuário",
      is_public: false,
    })
  }
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from("platform_settings")
    .select("setting_value")
    .eq("setting_key", keyFor(userId))
    .maybeSingle()

  let state: { active?: boolean } | null = null
  if (data?.setting_value) {
    try {
      state =
        typeof data.setting_value === "string" ? JSON.parse(data.setting_value) : (data.setting_value as any)
    } catch {
      state = null
    }
  }

  return NextResponse.json({ state: state?.active ? state : null })
}

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}) as Record<string, unknown>)
  const admin = createAdminClient()
  const settingKey = keyFor(userId)

  if (body.action === "deactivate") {
    await saveState(admin, settingKey, { active: false, deactivatedAt: new Date().toISOString() })
    return NextResponse.json({ state: null })
  }

  if (body.action === "activate") {
    const planId = String(body.planId || "")
    const plan = PLANS[planId]
    if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 })

    const state = {
      active: true,
      planId,
      amount: plan.amount,
      daily: plan.daily,
      activatedAt: new Date().toISOString(),
    }
    await saveState(admin, settingKey, state)
    return NextResponse.json({ state })
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 })
}
