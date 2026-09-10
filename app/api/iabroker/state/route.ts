import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Planos válidos (fonte de verdade no servidor). `daily` é o percentual ao dia.
const PLANS: Record<string, { amount: number; daily: number }> = {
  start: { amount: 500, daily: 5 },
  pro: { amount: 1000, daily: 7 },
  elite: { amount: 5000, daily: 9 },
}

const SECONDS_PER_DAY = 86_400
const MIN_CREDIT = 0.01 // só credita/avança o acerto quando o rendimento devido chega a 1 centavo

const keyFor = (userId: string) => `ia_broker_state:${userId}`

type IaState = {
  active: boolean
  paused?: boolean
  planId: string
  amount: number // valor investido (debitado do saldo na ativação)
  daily: number // percentual ao dia
  activatedAt: string
  lastSettleAt: string // marco do último acerto de rendimento
  totalCredited: number // rendimento real já creditado no saldo desde a ativação
  creditedToday?: number // rendimento já creditado dentro do dia atual (teto = meta diária)
  dayKey?: string // dia (YYYY-MM-DD, fuso -3) do acumulado atual; ao virar o dia, zera
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Chave de dia no fuso America/Sao_Paulo (UTC-3, sem horário de verão),
// para o teto diário zerar à meia-noite local.
const dayKeyOf = (ms: number) => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10)

async function getUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

async function readBalance(admin: SupabaseClient, userId: string): Promise<number> {
  const { data } = await admin.from("user_balances").select("balance_real").eq("user_id", userId).maybeSingle()
  return Number(data?.balance_real || 0)
}

async function writeBalance(admin: SupabaseClient, userId: string, newBalance: number) {
  await admin.from("user_balances").upsert(
    { user_id: userId, balance_real: round2(newBalance), updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  )
}

async function recordTransaction(
  admin: SupabaseClient,
  userId: string,
  type: string,
  amount: number,
  balanceAfter: number,
  description: string,
) {
  await admin.from("transactions").insert({
    user_id: userId,
    type,
    amount: round2(amount),
    balance_after: round2(balanceAfter),
    account_type: "real",
    description,
  })
}

async function loadState(admin: SupabaseClient, settingKey: string): Promise<IaState | null> {
  const { data } = await admin
    .from("platform_settings")
    .select("setting_value")
    .eq("setting_key", settingKey)
    .maybeSingle()
  if (!data?.setting_value) return null
  try {
    const parsed = typeof data.setting_value === "string" ? JSON.parse(data.setting_value) : data.setting_value
    return parsed && parsed.active ? (parsed as IaState) : null
  } catch {
    return null
  }
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

/**
 * Credita no saldo real o rendimento acumulado desde o último acerto.
 * O rendimento corre continuamente (mesmo com o site fechado): a IA "opera" enquanto ativa.
 * Fórmula: investido * (daily/100) por dia, proporcional aos segundos decorridos.
 * Enquanto pausada, o rendimento não corre.
 * Retorna o estado atualizado e o novo saldo.
 */
async function settle(
  admin: SupabaseClient,
  userId: string,
  settingKey: string,
  state: IaState,
): Promise<{ state: IaState; balance: number; credited: number }> {
  const now = Date.now()
  const balance = await readBalance(admin, userId)

  if (state.paused) {
    return { state, balance, credited: 0 }
  }

  // Teto diário = meta do dia (a % sobre o investido). O rendimento sobe aos poucos
  // ao longo do dia até bater essa meta e então para, voltando a render no dia seguinte.
  const dailyMeta = round2(state.amount * (state.daily / 100))
  const todayKey = dayKeyOf(now)

  let creditedToday = state.creditedToday || 0
  let dayKey = state.dayKey || dayKeyOf(new Date(state.activatedAt).getTime())
  const dayChanged = dayKey !== todayKey
  if (dayChanged) {
    // Virou o dia: zera o acumulado diário e recomeça a render até a meta.
    creditedToday = 0
    dayKey = todayKey
  }

  const last = new Date(state.lastSettleAt).getTime()
  const elapsedSec = Math.max(0, (now - last) / 1000)
  const perSecond = (state.amount * (state.daily / 100)) / SECONDS_PER_DAY
  const owed = perSecond * elapsedSec

  const remainingToday = round2(Math.max(0, dailyMeta - creditedToday))
  const creditNow = round2(Math.min(owed, remainingToday))

  if (creditNow < MIN_CREDIT) {
    // Nada relevante a creditar agora. Se a meta do dia já foi batida (ou o dia virou
    // sem rendimento devido), avança o marco e persiste o dia para não acumular tempo.
    if (remainingToday < MIN_CREDIT || dayChanged) {
      const updated: IaState = { ...state, lastSettleAt: new Date(now).toISOString(), creditedToday, dayKey }
      await saveState(admin, settingKey, updated)
      return { state: updated, balance, credited: 0 }
    }
    // Rendimento ainda insignificante: não credita nem avança o marco, para acumular.
    return { state, balance, credited: 0 }
  }

  const newBalance = round2(balance + creditNow)
  await writeBalance(admin, userId, newBalance)
  await recordTransaction(admin, userId, "ia_yield", creditNow, newBalance, "Rendimento do Robô de IA")

  const updated: IaState = {
    ...state,
    lastSettleAt: new Date(now).toISOString(),
    totalCredited: round2((state.totalCredited || 0) + creditNow),
    creditedToday: round2(creditedToday + creditNow),
    dayKey,
  }
  await saveState(admin, settingKey, updated)
  return { state: updated, balance: newBalance, credited: creditNow }
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const settingKey = keyFor(userId)
  const state = await loadState(admin, settingKey)

  if (!state) {
    return NextResponse.json({ state: null, balance: await readBalance(admin, userId) })
  }

  // Ao consultar, já acerta o rendimento acumulado (inclusive o tempo com o site fechado).
  const result = await settle(admin, userId, settingKey, state)
  return NextResponse.json({ state: result.state, balance: result.balance })
}

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const admin = createAdminClient()
  const settingKey = keyFor(userId)

  // Acerto periódico chamado pelo cliente enquanto a IA opera.
  if (body.action === "settle") {
    const state = await loadState(admin, settingKey)
    if (!state) return NextResponse.json({ state: null, balance: await readBalance(admin, userId) })
    const result = await settle(admin, userId, settingKey, state)
    return NextResponse.json({ state: result.state, balance: result.balance, credited: result.credited })
  }

  if (body.action === "pause" || body.action === "resume") {
    const state = await loadState(admin, settingKey)
    if (!state) return NextResponse.json({ state: null, balance: await readBalance(admin, userId) })

    if (body.action === "pause") {
      // Acerta o que corria até agora e congela.
      const result = await settle(admin, userId, settingKey, state)
      const paused: IaState = { ...result.state, paused: true }
      await saveState(admin, settingKey, paused)
      return NextResponse.json({ state: paused, balance: result.balance })
    }

    // resume: retoma a contagem a partir de agora.
    const resumed: IaState = { ...state, paused: false, lastSettleAt: new Date().toISOString() }
    await saveState(admin, settingKey, resumed)
    return NextResponse.json({ state: resumed, balance: await readBalance(admin, userId) })
  }

  if (body.action === "deactivate") {
    const state = await loadState(admin, settingKey)
    if (state) {
      // 1. Credita o rendimento pendente até agora.
      const result = await settle(admin, userId, settingKey, state)
      // 2. Devolve o valor investido ao saldo.
      const refunded = round2(result.balance + state.amount)
      await writeBalance(admin, userId, refunded)
      await recordTransaction(admin, userId, "ia_refund", state.amount, refunded, "Devolução do investimento do Robô de IA")
      await saveState(admin, settingKey, { active: false, deactivatedAt: new Date().toISOString() })
      return NextResponse.json({ state: null, balance: refunded })
    }
    await saveState(admin, settingKey, { active: false, deactivatedAt: new Date().toISOString() })
    return NextResponse.json({ state: null, balance: await readBalance(admin, userId) })
  }

  if (body.action === "activate") {
    const planId = String(body.planId || "")
    const plan = PLANS[planId]
    if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 })

    // Impede ativar duas vezes (não debita de novo se já estiver ativa).
    const existing = await loadState(admin, settingKey)
    if (existing?.active) {
      const result = await settle(admin, userId, settingKey, existing)
      return NextResponse.json({ state: result.state, balance: result.balance })
    }

    const balance = await readBalance(admin, userId)
    if (balance < plan.amount) {
      return NextResponse.json(
        { error: "insufficient_balance", balance, required: plan.amount },
        { status: 400 },
      )
    }

    // Debita o valor investido do saldo real.
    const newBalance = round2(balance - plan.amount)
    await writeBalance(admin, userId, newBalance)
    await recordTransaction(admin, userId, "ia_invest", -plan.amount, newBalance, "Investimento no Robô de IA")

    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const state: IaState = {
      active: true,
      paused: false,
      planId,
      amount: plan.amount,
      daily: plan.daily,
      activatedAt: nowIso,
      lastSettleAt: nowIso,
      totalCredited: 0,
      creditedToday: 0,
      dayKey: dayKeyOf(now),
    }
    await saveState(admin, settingKey, state)
    return NextResponse.json({ state, balance: newBalance })
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 })
}
