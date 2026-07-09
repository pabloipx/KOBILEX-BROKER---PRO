import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Retorna resposta controlada se Supabase não configurado
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: "Database not configured. Please add Supabase credentials.",
        configured: false,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const testEmail = "teste@gmail.com"
    const testPassword = "12345"

    let userId: string | null = null

    // Tenta criar usuário
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Usuário Teste" },
    })

    if (createError) {
      if (createError.message.includes("already") || createError.message.includes("exists")) {
        const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existingUser = listData?.users?.find((u) => u.email === testEmail)
        if (existingUser) {
          userId = existingUser.id
          await supabase.auth.admin.updateUserById(userId, { password: testPassword })
        }
      }
    } else if (createData?.user) {
      userId = createData.user.id
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: "Could not create or find user" })
    }

    // Setup profile e balance
    await supabase.from("profiles").upsert({
      id: userId, email: testEmail, full_name: "Usuário Teste",
      is_admin: true, is_verified: true, is_blocked: false,
    }, { onConflict: "id" })

    await supabase.from("user_balances").upsert({
      user_id: userId, balance_real: 5000.0, balance_demo: 10000.0, currency: "USD",
    }, { onConflict: "user_id" })

    // Setup símbolos OTC
    const symbols = [
      { symbol: "EURUSD_OTC", name: "Euro/US Dollar OTC", category: "forex", base_price: 1.085, volatility: 0.0008, payout_percentage: 96, min_trade_amount: 1, max_trade_amount: 10000, is_active: true },
      { symbol: "GBPUSD_OTC", name: "British Pound/US Dollar OTC", category: "forex", base_price: 1.263, volatility: 0.001, payout_percentage: 96, min_trade_amount: 1, max_trade_amount: 10000, is_active: true },
      { symbol: "USDJPY_OTC", name: "US Dollar/Japanese Yen OTC", category: "forex", base_price: 149.5, volatility: 0.0012, payout_percentage: 96, min_trade_amount: 1, max_trade_amount: 10000, is_active: true },
    ]

    for (const sym of symbols) {
      await supabase.from("otc_symbols").upsert(sym, { onConflict: "symbol" })
    }

    return NextResponse.json({
      success: true,
      message: "Setup completo!",
      testAccount: { email: testEmail, password: testPassword },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Setup failed",
    })
  }
}
