import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { amplopay } from "@/lib/amplopay"
import { approveDeposit, isPaidStatus } from "@/lib/deposits"

// Sempre dinamico - nunca cacheado
export const dynamic = "force-dynamic"
export const maxDuration = 60

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  return createClient(url, key)
}

/**
 * Verificacao automatica de depositos pendentes (cron).
 *
 * Roda no servidor a cada minuto (ver vercel.json) e consulta o status de cada deposito PIX
 * pendente diretamente na AmploPay. Se estiver pago, credita o saldo automaticamente — sem
 * depender do webhook chegar nem do app do cliente estar aberto. Isso elimina a necessidade
 * de aprovar depositos manualmente.
 */
async function handler(request: NextRequest) {
  // Seguranca: se CRON_SECRET estiver configurado, exige o header Authorization da Vercel.
  // Requisicoes de cron da Vercel chegam com "Authorization: Bearer <CRON_SECRET>".
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    const isVercelCron = request.headers.get("x-vercel-cron") !== null
    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Busca depositos PIX pendentes das ultimas 24h que tem referencia da AmploPay para consultar.
  // (PIX normalmente expira; manter a janela curta evita consultar transacoes antigas/expiradas.)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: pending, error } = await supabaseAdmin
    .from("deposits")
    .select("id, user_id, amount, status, payment_reference")
    .eq("status", "pending")
    .eq("method", "pix")
    .not("payment_reference", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[CRON] Erro ao buscar depositos pendentes:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let checked = 0
  let approved = 0

  for (const deposit of pending || []) {
    if (!deposit.payment_reference) continue
    checked++
    try {
      const tx = await amplopay.getTransactionStatus(deposit.payment_reference)
      if (tx && isPaidStatus(tx.status)) {
        const result = await approveDeposit(supabaseAdmin, deposit, tx.id)
        if (result.approved) {
          approved++
          console.log("[CRON] Deposito aprovado automaticamente:", deposit.id)
        }
      }
    } catch (err) {
      console.error("[CRON] Erro ao verificar deposito", deposit.id, err)
      // Continua verificando os demais
    }
  }

  return NextResponse.json({ success: true, checked, approved })
}

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}
