import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_POPUP_CONFIG, POPUP_SETTING_KEY, parsePopupConfig } from "@/lib/popup"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", POPUP_SETTING_KEY)
      .maybeSingle()

    const config = (data && parsePopupConfig(data.setting_value)) || DEFAULT_POPUP_CONFIG
    const images = config.enabled ? config.images.filter((img) => img.active) : []
    return NextResponse.json({ enabled: config.enabled, images })
  } catch (error) {
    console.error("Error fetching popup config:", error)
    return NextResponse.json({ enabled: false, images: [] })
  }
}
