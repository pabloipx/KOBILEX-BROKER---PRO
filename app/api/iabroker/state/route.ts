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
  amount: number // banca do plano (base de cálculo do rendimento)
  principalDebited?: boolean // true/ausente = banca foi debitada do saldo na ativação (código antigo, custodial). false = banca NÃO debitada (código atual). Controla se a banca é devolvida ao desativar.
  daily: number // percentual ao dia
  activatedAt: string
  lastSettleAt: string // marco do último acerto de rendimento
  totalCredited: number // rendimento real já creditado no saldo desde a ativação
  creditedToday?: number // rendimento já creditado dentro do dia atual (teto = meta diária)
  dayKey?: string // dia (YYYY-MM-DD, fuso -3) do acumulado atual; ao virar o dia, zera
  assertiveness?: number // taxa de acerto exibida ao usuário (controlada pelo admin)
  metaOverride?: number | null // meta diária personalizada (R$) definida pelo admin; sobrepõe a meta do plano
  earningEnabled?: boolean // admin pode desligar o rendimento deste usuário (default: true)
  lossMode?: boolean // admin coloca o usuário no PREJUÍZO do dia: em vez de render, o saldo cai até o alvo diário
  lossPerDay?: number | null // prejuízo alvo do dia (R$) definido pelo admin; se null, usa a meta do plano como magnitude
  lostToday?: number // quanto já foi debitado no dia atual em modo prejuízo (teto = prejuízo do dia)
  accruedToday?: number // progresso do dia no tempo (R$); decide quando cada entrada real fecha
  // Registro das "entradas" da IA como operações reais na tabela `trades`.
  tradesTargetToday?: number // quantas entradas a IA fará no dia atual (8–12, sorteado ao virar o dia)
  tradesToday?: number // quantas entradas já foram registradas hoje
  tradesProfitToday?: number // soma do profit das entradas de hoje (deve fechar igual ao rendimento do dia)
  tradesTotal?: number // total acumulado de entradas desde a ativação (exibido no card "Entradas")
}

const DEFAULT_ASSERTIVENESS = 87 // taxa de acerto padrão exibida ao usuário

const round2 = (n: number) => Math.round(n * 100) / 100

// Chave de dia no fuso America/Sao_Paulo (UTC-3, sem horário de verão),
// para o teto diário zerar à meia-noite local.
const dayKeyOf = (ms: number) => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10)

// --- Registro das entradas da IA como operações reais em `trades` ---
// As entradas aparecem no histórico da tela de TRADE. Elas são gravadas JÁ FECHADAS
// (status "closed", result WIN/LOSS, profit definido), então NÃO movimentam saldo por conta
// própria (o rendimento já é creditado como `ia_yield`) e NÃO colidem com a operação manual do
// usuário (que só bloqueia quando existe uma operação PENDING). A soma do profit das entradas do
// dia fecha exatamente igual ao rendimento creditado no dia (a última entrada reconcilia).
const AI_TRADE_SYMBOLS: { symbol: string; price: number }[] = [
  { symbol: "EURUSD_OTC", price: 1.0857 },
  { symbol: "GBPUSD_OTC", price: 1.2712 },
  { symbol: "USDJPY_OTC", price: 156.82 },
  { symbol: "AUDUSD_OTC", price: 0.6634 },
  { symbol: "BTCUSD_OTC", price: 64231 },
]
const AI_TIMEFRAMES = [60, 300, 600]
const roundPrice = (p: number) => (p >= 1000 ? Math.round(p * 100) / 100 : Math.round(p * 100000) / 100000)
// Quantidade de entradas por dia: 8 a 12, sorteada ao virar o dia.
const planDailyTrades = () => 8 + Math.floor(Math.random() * 5)

const MIN_ENTRY = 1 // entrada mínima do gráfico (R$)
const PAYOUT = 0.96

type AiEntry = { amount: number; profit: number }

// Entradas com valor inteiro em reais (mínimo R$1), como um operador faria no gráfico.
const winEntry = (avg: number, lo: number, hi: number): AiEntry => {
  const amount = Math.max(MIN_ENTRY, Math.round((avg * (lo + Math.random() * (hi - lo))) / PAYOUT))
  return { amount, profit: round2(amount * PAYOUT) }
}
const lossEntry = (avg: number, lo: number, hi: number): AiEntry => {
  const amount = Math.max(MIN_ENTRY, Math.round(avg * (lo + Math.random() * (hi - lo))))
  return { amount, profit: -amount }
}
// Última entrada do dia: fecha o resultado exatamente no alvo.
const finalEntry = (remaining: number): AiEntry =>
  remaining >= 0
    ? { amount: Math.max(MIN_ENTRY, round2(remaining / PAYOUT)), profit: round2(remaining) }
    : { amount: Math.max(MIN_ENTRY, round2(-remaining)), profit: round2(remaining) }

function buildAiTradeRow(userId: string, amount: number, profit: number, offsetIndex: number) {
  const s = AI_TRADE_SYMBOLS[Math.floor(Math.random() * AI_TRADE_SYMBOLS.length)]
  const direction: "CALL" | "PUT" = Math.random() < 0.5 ? "CALL" : "PUT"
  // O app inteiro (tela de TRADE, histórico) usa result em minúsculo: "win"/"loss".
  // Gravar em maiúsculo fazia as entradas da IA aparecerem como pendentes eternas.
  const result: "win" | "loss" = profit >= 0 ? "win" : "loss"
  const win = result === "win"
  const up = direction === "CALL"
  const delta = s.price * (0.0004 + Math.random() * 0.0006)
  const entryPrice = s.price
  // Preço de saída coerente com o resultado e a direção exibidos.
  const exitPrice = win === up ? entryPrice + delta : entryPrice - delta
  const timeframe = AI_TIMEFRAMES[Math.floor(Math.random() * AI_TIMEFRAMES.length)]
  // Espaça as entradas emitidas no mesmo ciclo para não terem o mesmo horário.
  const now = Date.now() - offsetIndex * 90_000
  return {
    user_id: userId,
    symbol: s.symbol,
    direction,
    amount: round2(amount),
    entry_price: roundPrice(entryPrice),
    exit_price: roundPrice(exitPrice),
    timeframe,
    payout_percentage: 0.96,
    result,
    profit: round2(profit),
    status: "closed",
    is_demo: false,
    entry_time: new Date(now - timeframe * 1000).toISOString(),
    expiry_time: new Date(now).toISOString(),
    closed_at: new Date(now).toISOString(),
  }
}

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
 * Acerto da IA por ENTRADAS REAIS.
 * O progresso do dia corre no tempo (mesmo com o site fechado), mas o saldo só se move quando uma
 * entrada fecha: cada entrada tem valor mínimo de R$1,00, payout de 96%, é gravada em `trades`
 * (aparece no histórico da tela de TRADE) e credita/debita o saldo pelo seu próprio resultado.
 * A última entrada do dia reconcilia o resultado para fechar exatamente na meta (ou no prejuízo alvo).
 * Enquanto pausada, nada corre.
 */
async function settle(
  admin: SupabaseClient,
  userId: string,
  settingKey: string,
  state: IaState,
): Promise<{ state: IaState; balance: number; credited: number }> {
  const now = Date.now()
  const balance = await readBalance(admin, userId)

  if (state.paused) return { state, balance, credited: 0 }

  const lossMode = state.lossMode === true
  // Admin pode desligar o rendimento por completo (não vale para o modo prejuízo).
  if (!lossMode && state.earningEnabled === false) return { state, balance, credited: 0 }

  const planMeta = round2(state.amount * (state.daily / 100))
  const goalAbs = lossMode
    ? state.lossPerDay != null && Number.isFinite(state.lossPerDay) && state.lossPerDay > 0
      ? round2(state.lossPerDay)
      : planMeta
    : state.metaOverride != null && Number.isFinite(state.metaOverride) && state.metaOverride >= 0
      ? round2(state.metaOverride)
      : planMeta
  const goal = lossMode ? -goalAbs : goalAbs
  const perSecond = (lossMode ? goalAbs : planMeta) / SECONDS_PER_DAY

  const todayKey = dayKeyOf(now)
  let dayKey = state.dayKey || dayKeyOf(new Date(state.activatedAt).getTime())
  // Resultado realizado hoje (com sinal): positivo no modo normal, negativo no modo prejuízo.
  let realized = lossMode ? -(state.lostToday || 0) : state.creditedToday || 0
  let accrued = state.accruedToday ?? Math.abs(realized)
  let tradesToday = state.tradesToday || 0
  let tradesProfitToday = state.tradesProfitToday || 0
  let tradesTargetToday = state.tradesTargetToday || planDailyTrades()
  let tradesTotal = state.tradesTotal || 0

  if (dayKey !== todayKey) {
    dayKey = todayKey
    realized = 0
    accrued = 0
    tradesToday = 0
    tradesProfitToday = 0
    tradesTargetToday = planDailyTrades()
  }

  const last = new Date(state.lastSettleAt).getTime()
  const elapsedSec = Math.max(0, (now - last) / 1000)
  accrued = Math.min(goalAbs, accrued + perSecond * elapsedSec)

  // Metas pequenas geram menos entradas, para cada uma respeitar a entrada mínima.
  const target = goalAbs > 0 ? Math.max(1, Math.min(tradesTargetToday, Math.floor(goalAbs / 1.5))) : 0
  const progress = goalAbs > 0 ? accrued / goalAbs : 0
  // A entrada final (que reconcilia o dia) só sai quando o progresso do dia fecha.
  const shouldHave =
    target === 0 ? 0 : progress >= 1 ? target : Math.min(target - 1, Math.ceil(progress * target))

  let runningBalance = balance
  let delta = 0
  const rows: ReturnType<typeof buildAiTradeRow>[] = []
  const txs: Record<string, unknown>[] = []
  const avg = target > 0 ? goalAbs / target : 0

  while (tradesToday < shouldHave) {
    const isFinal = tradesToday + 1 === target
    let entry: AiEntry
    if (isFinal) {
      const remaining = round2(goal - realized)
      if (Math.abs(remaining) < 0.01) {
        tradesToday += 1
        continue
      }
      entry = finalEntry(remaining)
    } else if (lossMode) {
      entry = Math.random() < 0.3 ? winEntry(avg, 0.2, 0.55) : lossEntry(avg, 1.1, 1.7)
    } else {
      entry = Math.random() < 0.65 ? winEntry(avg, 1.05, 1.65) : lossEntry(avg, 0.3, 0.8)
    }

    // O saldo nunca fica negativo: a perda fica limitada ao que há disponível.
    if (entry.profit < 0 && runningBalance + entry.profit < 0) {
      const cap = Math.floor(runningBalance)
      if (cap < MIN_ENTRY) break
      entry = { amount: cap, profit: -cap }
    }

    const row = buildAiTradeRow(userId, entry.amount, entry.profit, rows.length)
    runningBalance = round2(runningBalance + entry.profit)
    delta = round2(delta + entry.profit)
    realized = round2(realized + entry.profit)
    tradesProfitToday = round2(tradesProfitToday + entry.profit)
    tradesToday += 1
    tradesTotal += 1
    rows.push(row)
    txs.push({
      user_id: userId,
      type: "ia_yield",
      amount: entry.profit,
      balance_after: runningBalance,
      account_type: "real",
      description: `Operação do Robô de IA · ${row.symbol} ${row.direction === "CALL" ? "COMPRA" : "VENDA"} R$ ${entry.amount.toFixed(2)}`,
    })
  }

  if (rows.length) {
    await admin.from("trades").insert(rows)
    await writeBalance(admin, userId, runningBalance)
    await admin.from("transactions").insert(txs)
  }

  const updated: IaState = {
    ...state,
    lastSettleAt: new Date(now).toISOString(),
    totalCredited: round2((state.totalCredited || 0) + delta),
    dayKey,
    accruedToday: accrued,
    ...(lossMode ? { lostToday: round2(-realized) } : { creditedToday: realized }),
    tradesToday,
    tradesProfitToday,
    tradesTargetToday,
    tradesTotal,
  }
  await saveState(admin, settingKey, updated)
  return { state: updated, balance: runningBalance, credited: delta }
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
      let finalBalance = result.balance
      // 2. Migração: estados ativados sob o código antigo (custodial) TIVERAM a banca do plano
      // debitada do saldo na ativação (principalDebited ausente/true). Ao finalizar, devolvemos essa
      // banca para que ela volte ao saldo JUNTO com o lucro — corrigindo o caso em que "sumiam os
      // R$5.000 e sobrava só o lucro". Estados novos (principalDebited === false) não debitaram nada.
      if (state.principalDebited !== false && state.amount > 0) {
        finalBalance = round2(result.balance + state.amount)
        await writeBalance(admin, userId, finalBalance)
        await recordTransaction(
          admin,
          userId,
          "ia_refund",
          state.amount,
          finalBalance,
          "Devolução da banca do Robô de IA",
        )
      }
      await saveState(admin, settingKey, { active: false, deactivatedAt: new Date().toISOString() })
      return NextResponse.json({ state: null, balance: finalBalance })
    }
    await saveState(admin, settingKey, { active: false, deactivatedAt: new Date().toISOString() })
    return NextResponse.json({ state: null, balance: await readBalance(admin, userId) })
  }

  if (body.action === "activate") {
    const planId = String(body.planId || "")
    const plan = PLANS[planId]
    if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 })

    // Impede ativar duas vezes.
    const existing = await loadState(admin, settingKey)
    if (existing?.active) {
      const result = await settle(admin, userId, settingKey, existing)
      return NextResponse.json({ state: result.state, balance: result.balance })
    }

    // O plano é apenas a base de cálculo do rendimento — não desconta do saldo.
    // Exige saldo suficiente para escolher o plano, mas não debita nada.
    const balance = await readBalance(admin, userId)
    if (balance < plan.amount) {
      return NextResponse.json(
        { error: "insufficient_balance", balance, required: plan.amount },
        { status: 400 },
      )
    }

    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const state: IaState = {
      active: true,
      paused: false,
      planId,
      amount: plan.amount,
      principalDebited: false, // modelo atual: a banca NÃO é debitada, então nada será devolvido ao desativar
      daily: plan.daily,
      activatedAt: nowIso,
      lastSettleAt: nowIso,
      totalCredited: 0,
      creditedToday: 0,
      accruedToday: 0,
      dayKey: dayKeyOf(now),
      assertiveness: DEFAULT_ASSERTIVENESS,
      metaOverride: null,
      earningEnabled: true,
    }
    await saveState(admin, settingKey, state)
    return NextResponse.json({ state, balance })
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 })
}
