import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { buildBalanceUpsert } from "@/lib/admin-balance"

const ADMIN_EMAILS = ["pablotrader1790@gmail.com", "pabloandrade1790@gmail.com", "admin@atlasinvest.com"]
const ADMIN_PASSWORD = "Admin123!"

function isAdminAuthenticated(request: Request): boolean {
  const adminToken = request.headers.get("x-admin-token")
  return adminToken === ADMIN_PASSWORD
}

export async function GET(request: Request) {
  try {
    if (!isAdminAuthenticated(request)) {
      return NextResponse.json({ error: "Unauthorized", details: "Invalid admin token" }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Buscar todos os usuários usando admin client (ignora RLS).
    // Nao usamos join embutido (`user_balances ( ... )`): nao existe foreign key entre `profiles` e
    // `user_balances`, entao o PostgREST recusava a consulta com "Could not find a relationship" e
    // esta rota devolvia erro em vez da lista — a tela de usuarios ficava sem saldo nenhum.
    const { data: users, error: usersError } = await adminClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (usersError) {
      return NextResponse.json({ error: "Failed to fetch users", details: usersError.message }, { status: 500 })
    }

    // Busca os saldos em uma consulta separada e associa em memoria por user_id.
    const userIds = (users || []).map((u: any) => u.id)
    const { data: balances } = userIds.length
      ? await adminClient.from("user_balances").select("user_id, balance_real, balance_demo").in("user_id", userIds)
      : { data: [] as any[] }

    const balanceByUser = new Map((balances || []).map((b: any) => [b.user_id, b]))

    const mappedUsers = (users || []).map((u: any) => ({
      id: u.id,
      email: u.email || "",
      full_name: u.full_name || "",
      phone: u.phone || "",
      is_blocked: u.is_blocked || false,
      is_verified: u.is_verified || false,
      is_admin: u.is_admin || false,
      created_at: u.created_at,
      // `?? 0` preserva saldo zero legitimo em vez de trocar por outro valor.
      balance_real: Number(balanceByUser.get(u.id)?.balance_real ?? 0),
      balance_demo: Number(balanceByUser.get(u.id)?.balance_demo ?? 0),
    }))

    return NextResponse.json(mappedUsers)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!isAdminAuthenticated(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const body = await request.json()
    const { userId, full_name, phone, balance_real, balance_demo, is_blocked, is_verified } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Update profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name,
        phone,
        is_blocked,
        is_verified,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (profileError) {
      return NextResponse.json({ error: "Failed to update profile", details: profileError.message }, { status: 500 })
    }

    // Atualiza o saldo somente com as contas realmente informadas. Antes um `Number(undefined) || 0`
    // zerava o saldo que nao veio no formulario, e o valor "sumia" ao recarregar a pagina.
    const balanceRow = buildBalanceUpsert(userId, balance_real, balance_demo)
    if (balanceRow) {
      const { error: balanceError } = await adminClient
        .from("user_balances")
        .upsert(balanceRow, { onConflict: "user_id" })

      if (balanceError) {
        return NextResponse.json({ error: "Failed to update balance", details: balanceError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}
