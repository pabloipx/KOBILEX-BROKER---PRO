import { NextResponse } from "next/server"
import { getTradeManager } from "@/lib/trade-engine/trade-manager"

export async function POST(request: Request) {
  try {
    // Verifica se Supabase está configurado
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { symbol, direction, amount, timeframe } = body

    if (!symbol || !direction || !amount || !timeframe) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["CALL", "PUT"].includes(direction)) {
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 })
    }

    if (![60, 300, 600].includes(timeframe)) {
      return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const { data: existingTrade } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", user.id)
      .eq("result", "PENDING")
      .single()

    if (existingTrade) {
      return NextResponse.json({ error: "You already have an active trade" }, { status: 400 })
    }

    const tradeManager = getTradeManager()
    const result = await tradeManager.openTrade(user.id, symbol, direction, amount, timeframe)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      trade: result.trade,
      newBalance: result.newBalance,
    })
  } catch (error) {
    console.error("Error opening trade:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
