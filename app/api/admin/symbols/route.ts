import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ADMIN_EMAILS } from "@/lib/admin/check-admin"

async function verifyAdmin() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isAdmin: false, adminClient }

  const { data: profile } = await adminClient.from("profiles").select("is_admin, email").eq("id", user.id).single()

  const isAdmin =
    profile?.is_admin === true || ADMIN_EMAILS.includes(user.email || "") || ADMIN_EMAILS.includes(profile?.email || "")

  return { isAdmin, adminClient }
}

export async function GET() {
  try {
    const { isAdmin, adminClient } = await verifyAdmin()

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: symbols, error } = await adminClient.from("otc_symbols").select("*").order("symbol")

    if (error) throw error

    return NextResponse.json({ symbols: symbols || [] })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAdmin, adminClient } = await verifyAdmin()

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, volatility, is_active } = body

    if (!id) {
      return NextResponse.json({ error: "Symbol ID required" }, { status: 400 })
    }

    const updateData: any = {}
    if (volatility !== undefined) updateData.volatility = volatility
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await adminClient.from("otc_symbols").update(updateData).eq("id", id).select().single()

    if (error) throw error

    return NextResponse.json({ success: true, symbol: data })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
