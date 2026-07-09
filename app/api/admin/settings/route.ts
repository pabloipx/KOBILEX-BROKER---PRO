import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const ADMIN_TOKEN = "Admin123!"

function verifyAdminToken(request: Request): boolean {
  const token = request.headers.get("x-admin-token")
  return token === ADMIN_TOKEN
}

export async function GET(request: Request) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: settings, error } = await adminClient.from("platform_settings").select("*")
    if (error) throw error

    const settingsObj: Record<string, string> = {}
    for (const s of settings || []) {
      settingsObj[s.setting_key] = s.setting_value
    }

    return NextResponse.json(settingsObj)
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function upsertSetting(adminClient: any, key: string, value: string) {
  const { error: updateError, count } = await adminClient
    .from("platform_settings")
    .update({ setting_value: value, updated_at: new Date().toISOString() })
    .eq("setting_key", key)
    .select()

  if (updateError || count === 0) {
    await adminClient
      .from("platform_settings")
      .insert({ setting_key: key, setting_value: value })
  }
}

export async function POST(request: Request) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const body = await request.json()

    if (body.card_deposit_enabled !== undefined) {
      await upsertSetting(adminClient, "card_deposit_enabled", String(body.card_deposit_enabled))
    }

    if (body.crypto_deposit_enabled !== undefined) {
      await upsertSetting(adminClient, "crypto_deposit_enabled", String(body.crypto_deposit_enabled))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  return POST(request)
}
