import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRequest } from "@/lib/admin/session"
import { DEFAULT_POPUP_CONFIG, POPUP_SETTING_KEY, parsePopupConfig } from "@/lib/popup"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", POPUP_SETTING_KEY)
      .maybeSingle()
    return NextResponse.json((data && parsePopupConfig(data.setting_value)) || DEFAULT_POPUP_CONFIG)
  } catch (error) {
    console.error("Error fetching popup config:", error)
    return NextResponse.json({ error: "Erro ao carregar pop-up" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const config = parsePopupConfig(await request.json())
    if (!config) {
      return NextResponse.json({ error: "Configuração inválida" }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const value = JSON.stringify(config)
    const { data: existing } = await adminClient
      .from("platform_settings")
      .select("setting_key")
      .eq("setting_key", POPUP_SETTING_KEY)
      .maybeSingle()

    const { error } = existing
      ? await adminClient
          .from("platform_settings")
          .update({ setting_value: value, updated_at: new Date().toISOString() })
          .eq("setting_key", POPUP_SETTING_KEY)
      : await adminClient.from("platform_settings").insert({ setting_key: POPUP_SETTING_KEY, setting_value: value })

    if (error) throw error
    return NextResponse.json(config)
  } catch (error) {
    console.error("Error saving popup config:", error)
    return NextResponse.json({ error: "Erro ao salvar pop-up" }, { status: 500 })
  }
}
