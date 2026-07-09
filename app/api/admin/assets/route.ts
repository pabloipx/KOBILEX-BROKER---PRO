import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ASSET_CATALOG } from "@/lib/asset-catalog"

export const dynamic = "force-dynamic"

const ADMIN_TOKEN = "Admin123!"

function verifyAdminToken(request: Request): boolean {
  return request.headers.get("x-admin-token") === ADMIN_TOKEN
}

export async function GET(request: Request) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: rows, error } = await adminClient.from("asset_settings").select("symbol, enabled, sort_order")
    if (error) throw error

    const settings = new Map((rows || []).map((r: any) => [r.symbol, r]))

    const assets = ASSET_CATALOG.map((a, index) => {
      const row = settings.get(a.symbol)
      return {
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        payout: a.payout,
        logo: a.logo,
        enabled: row ? row.enabled : true,
        sortOrder: row?.sort_order ?? index,
      }
    }).sort((a, b) => a.sortOrder - b.sortOrder)

    return NextResponse.json({ assets })
  } catch (error) {
    console.error("Error fetching assets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { symbol, enabled } = body

    if (typeof symbol !== "string" || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "symbol e enabled são obrigatórios" }, { status: 400 })
    }
    if (!ASSET_CATALOG.some((a) => a.symbol === symbol)) {
      return NextResponse.json({ error: "Ativo inválido" }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from("asset_settings")
      .upsert({ symbol, enabled, updated_at: new Date().toISOString() }, { onConflict: "symbol" })
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating asset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
