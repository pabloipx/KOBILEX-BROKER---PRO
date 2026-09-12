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
  assertiveness?: number // taxa de acerto exibida ao usuário (controlada pelo admin)
  metaOverride?: number | null // meta diária personalizada (R$) definida pelo admin; sobrepõe a meta do plano
  earningEnabled?: boolean // admin pode desligar o rendimento deste usuário (default: true)
  lossMode?: boolean // admin coloca o usuário no PREJUÍZO do dia: em vez de render, o saldo cai até o alvo diário
  lossPerDay?: number | null // prejuízo alvo do dia (R$) definido pelo admin; se null, usa a meta do plano como magnitude
  lostToday?: number // quanto já foi debitado no dia atual em modo prejuízo (teto = prejuízo do dia)
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

function buildAiTradeRow(userId: string, profit: number, offsetIndex: number) {
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
  // Valor "aplicado" compatível com o payout de 96%, para o registro parecer real.
  const amount = Math.max(0.01, win ? round2(profit / 0.96) : round2(Math.abs(profit)))
  // Espaça as entradas emitidas no mesmo ciclo para não terem o mesmo horário.
  const now = Date.now() - offsetIndex * 1500
  return {
    user_id: userId,
    symbol: s.symbol,
    direction,
    amount,
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

  // Pausa congela tudo (nem rende nem perde), preservando o estado.
  if (state.paused) {
    return { state, balance, credited: 0 }
  }

  // Modo prejuízo: o admin decidiu que hoje o usuário PERDE dinheiro. O saldo cai aos poucos
  // até o alvo diário e as entradas do dia fecham negativas. Roda independentemente do earningEnabled.
  if (state.lossMode === true) {
    return settleLoss(admin, userId, settingKey, state)
  }

  // Admin pode desligar o rendimento por completo (earningEnabled=false): não rende nem perde.
  if (state.earningEnabled === false) {
    return { state, balance, credited: 0 }
  }

  // Teto diário = meta do dia (a % sobre o investido). O rendimento sobe aos poucos
  // ao longo do dia até bater essa meta e então para, voltando a render no dia seguinte.
  // Meta do dia: usa a meta personalizada do admin quando definida; senão, a meta do plano (a % sobre o investido).
  const dailyMeta =
    state.metaOverride != null && Number.isFinite(state.metaOverride) && state.metaOverride >= 0
      ? round2(state.metaOverride)
      : round2(state.amount * (state.daily / 100))
  const todayKey = dayKeyOf(now)

  let creditedToday = state.creditedToday || 0
  let dayKey = state.dayKey || dayKeyOf(new Date(state.activatedAt).getTime())

  // Contadores das entradas da IA. Os "de hoje" zeram ao virar o dia; o total é acumulado.
  let tradesToday = state.tradesToday || 0
  let tradesProfitToday = state.tradesProfitToday || 0
  let tradesTargetToday = state.tradesTargetToday || planDailyTrades()
  let tradesTotal = state.tradesTotal || 0

  const dayChanged = dayKey !== todayKey
  if (dayChanged) {
    // Virou o dia: zera o acumulado diário e recomeça a render até a meta.
    creditedToday = 0
    dayKey = todayKey
    // Novo dia => novo plano de entradas (8–12) e contadores diários zerados.
    tradesToday = 0
    tradesProfitToday = 0
    tradesTargetToday = planDailyTrades()
  }

  // Emite as entradas reais que faltam para acompanhar o progresso do rendimento do dia.
  // As entradas surgem aos poucos: a k-ésima entrada entra quando o rendimento passa de k/target
  // da meta. A última entrada do dia reconcilia o profit para fechar igual ao rendimento creditado.
  const runEmission = async () => {
    const target = tradesTargetToday
    if (target <= 0 || dailyMeta <= 0) return
    const progress = Math.min(1, creditedToday / dailyMeta)
    // Assim que há rendimento creditado, a 1ª entrada já aparece (ceil). A entrada final
    // (que reconcilia o dia) fica reservada para quando a meta fecha (progress >= 1).
    const shouldHave = progress >= 1 ? target : Math.min(target - 1, Math.ceil(progress * target))
    const rows: ReturnType<typeof buildAiTradeRow>[] = []
    while (tradesToday < shouldHave) {
      const isFinal = tradesToday + 1 === target
      const avg = dailyMeta / target
      let profit: number
      if (isFinal) {
        // Fecha o dia exatamente no rendimento creditado (mix de WIN/LOSS, dia positivo).
        profit = round2(creditedToday - tradesProfitToday)
      } else {
        const loss = Math.random() < 0.35
        profit = loss
          ? -round2(avg * (0.3 + Math.random() * 0.5))
          : round2(avg * (1.05 + Math.random() * 0.6))
      }
      rows.push(buildAiTradeRow(userId, profit, rows.length))
      tradesProfitToday = round2(tradesProfitToday + profit)
      tradesToday += 1
      tradesTotal += 1
    }
    if (rows.length) await admin.from("trades").insert(rows)
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
      // Meta já batida: garante que as entradas restantes do dia sejam registradas.
      await runEmission()
      const updated: IaState = {
        ...state,
        lastSettleAt: new Date(now).toISOString(),
        creditedToday,
        dayKey,
        tradesToday,
        tradesProfitToday,
        tradesTargetToday,
        tradesTotal,
      }
      await saveState(admin, settingKey, updated)
      return { state: updated, balance, credited: 0 }
    }
    // Rendimento ainda insignificante: não credita nem avança o marco, para acumular.
    return { state, balance, credited: 0 }
  }

  const newBalance = round2(balance + creditNow)
  await writeBalance(admin, userId, newBalance)
  await recordTransaction(admin, userId, "ia_yield", creditNow, newBalance, "Rendimento do Robô de IA")

  creditedToday = round2(creditedToday + creditNow)
  // Registra as entradas correspondentes ao novo patamar de rendimento do dia.
  await runEmission()

  const updated: IaState = {
    ...state,
    lastSettleAt: new Date(now).toISOString(),
    totalCredited: round2((state.totalCredited || 0) + creditNow),
    creditedToday,
    dayKey,
    tradesToday,
    tradesProfitToday,
    tradesTargetToday,
    tradesTotal,
  }
  await saveState(admin, settingKey, updated)
  return { state: updated, balance: newBalance, credited: creditNow }
}

/**
 * Modo prejuízo: o admin definiu que hoje o usuário PERDE dinheiro.
 * Espelha o `settle`, mas com sinal invertido: o saldo cai aos poucos até o prejuízo alvo do dia
 * (lossPerDay, ou a meta do plano como magnitude), nunca deixando o saldo ficar negativo.
 * As entradas do dia fecham negativas (soma = -lostToday) e aparecem no histórico da tela de TRADE.
 */
async function settleLoss(
  admin: SupabaseClient,
  userId: string,
  settingKey: string,
  state: IaState,
): Promise<{ state: IaState; balance: number; credited: number }> {
  const now = Date.now()
  const balance = await readBalance(admin, userId)

  // Prejuízo alvo do dia: valor definido pelo admin ou, na falta dele, a magnitude da meta do plano.
  const dailyLoss =
    state.lossPerDay != null && Number.isFinite(state.lossPerDay) && state.lossPerDay > 0
      ? round2(state.lossPerDay)
      : round2(state.amount * (state.daily / 100))
  const todayKey = dayKeyOf(now)

  let lostToday = state.lostToday || 0
  let dayKey = state.dayKey || dayKeyOf(new Date(state.activatedAt).getTime())

  let tradesToday = state.tradesToday || 0
  let tradesProfitToday = state.tradesProfitToday || 0
  let tradesTargetToday = state.tradesTargetToday || planDailyTrades()
  let tradesTotal = state.tradesTotal || 0

  const dayChanged = dayKey !== todayKey
  if (dayChanged) {
    lostToday = 0
    dayKey = todayKey
    tradesToday = 0
    tradesProfitToday = 0
    tradesTargetToday = planDailyTrades()
  }

  // Emissão das entradas: em modo prejuízo a maioria perde e o dia fecha negativo (soma = -lostToday).
  const runEmission = async () => {
    const target = tradesTargetToday
    if (target <= 0 || dailyLoss <= 0) return
    const progress = Math.min(1, lostToday / dailyLoss)
    // Assim que há prejuízo debitado, a 1ª entrada já aparece (ceil). A entrada final
    // (que reconcilia o dia no vermelho) fica reservada para quando o alvo fecha (progress >= 1).
    const shouldHave = progress >= 1 ? target : Math.min(target - 1, Math.ceil(progress * target))
    const rows: ReturnType<typeof buildAiTradeRow>[] = []
    while (tradesToday < shouldHave) {
      const isFinal = tradesToday + 1 === target
      const avg = dailyLoss / target
      let profit: number
      if (isFinal) {
        // Fecha o dia exatamente no prejuízo acumulado (soma negativa).
        profit = round2(-lostToday - tradesProfitToday)
      } else {
        // Maioria perde; alguns acertos pequenos deixam o histórico crível, mas o dia fecha no vermelho.
        const win = Math.random() < 0.3
        profit = win
          ? round2(avg * (0.2 + Math.random() * 0.35))
          : -round2(avg * (1.1 + Math.random() * 0.6))
      }
      rows.push(buildAiTradeRow(userId, profit, rows.length))
      tradesProfitToday = round2(tradesProfitToday + profit)
      tradesToday += 1
      tradesTotal += 1
    }
    if (rows.length) await admin.from("trades").insert(rows)
  }

  const last = new Date(state.lastSettleAt).getTime()
  const elapsedSec = Math.max(0, (now - last) / 1000)
  const perSecond = dailyLoss / SECONDS_PER_DAY
  const owed = perSecond * elapsedSec

  const remainingToday = round2(Math.max(0, dailyLoss - lostToday))
  // Nunca debita mais do que o saldo disponível (o saldo não fica negativo).
  const debitNow = round2(Math.min(owed, remainingToday, Math.max(0, balance)))

  if (debitNow < MIN_CREDIT) {
    // Nada relevante a debitar agora. Se o alvo já foi atingido (ou o dia virou), avança o marco.
    if (remainingToday < MIN_CREDIT || balance < MIN_CREDIT || dayChanged) {
      await runEmission()
      const updated: IaState = {
        ...state,
        lastSettleAt: new Date(now).toISOString(),
        lostToday,
        dayKey,
        tradesToday,
        tradesProfitToday,
        tradesTargetToday,
        tradesTotal,
      }
      await saveState(admin, settingKey, updated)
      return { state: updated, balance, credited: 0 }
    }
    return { state, balance, credited: 0 }
  }

  const newBalance = round2(balance - debitNow)
  await writeBalance(admin, userId, newBalance)
  await recordTransaction(admin, userId, "ia_yield", -debitNow, newBalance, "Ajuste de operação do Robô de IA")

  lostToday = round2(lostToday + debitNow)
  await runEmission()

  const updated: IaState = {
    ...state,
    lastSettleAt: new Date(now).toISOString(),
    totalCredited: round2((state.totalCredited || 0) - debitNow),
    lostToday,
    dayKey,
    tradesToday,
    tradesProfitToday,
    tradesTargetToday,
    tradesTotal,
  }
  await saveState(admin, settingKey, updated)
  return { state: updated, balance: newBalance, credited: -debitNow }
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
      // Credita o rendimento pendente até agora. O plano não foi debitado,
      // então não há valor a devolver — apenas encerra a operação.
      const result = await settle(admin, userId, settingKey, state)
      await saveState(admin, settingKey, { active: false, deactivatedAt: new Date().toISOString() })
      return NextResponse.json({ state: null, balance: result.balance })
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
      daily: plan.daily,
      activatedAt: nowIso,
      lastSettleAt: nowIso,
      totalCredited: 0,
      creditedToday: 0,
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
