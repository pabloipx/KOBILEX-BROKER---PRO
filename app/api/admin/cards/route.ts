import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ADMIN_TOKEN = "Admin123!"

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token")
  return token === ADMIN_TOKEN
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  try {
    const supabase = getAdminClient()

    const { data: cardDeposits, error } = await supabase
      .from("card_deposits")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    const userIds = [...new Set((cardDeposits || []).map((c: any) => c.user_id))]
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const enriched = (cardDeposits || []).map((card: any) => ({
      ...card,
      user_email: profileMap.get(card.user_id)?.email || "N/A",
      user_name: profileMap.get(card.user_id)?.full_name || "N/A",
    }))

    return NextResponse.json({ cards: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  try {
    const supabase = getAdminClient()
    const { cardId, status } = await req.json()

    if (!cardId || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })
    }

    const { data: card, error: cardError } = await supabase
      .from("card_deposits")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", cardId)
      .select()
      .single()

    if (cardError) throw cardError

    if (status === "approved" && card.deposit_id) {
      await supabase
        .from("deposits")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", card.deposit_id)

      const { data: balance } = await supabase
        .from("user_balances")
        .select("balance_real")
        .eq("user_id", card.user_id)
        .single()

      const currentBalance = balance?.balance_real || 0
      const newBalance = Math.round((currentBalance + Number(card.amount)) * 100) / 100

      await supabase
        .from("user_balances")
        .update({ balance_real: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", card.user_id)
    }

    if (status === "rejected" && card.deposit_id) {
      await supabase
        .from("deposits")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", card.deposit_id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
