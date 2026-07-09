import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createClient()

    // Check if test user already exists
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", "teste@gmail.com")
      .single()

    if (existingUser) {
      // Update balance to $1000
      await supabase.from("user_balances").update({ balance: 1000.0 }).eq("user_id", existingUser.id)

      return NextResponse.json({
        success: true,
        message: "Test user balance updated to $1000",
        userId: existingUser.id,
      })
    }

    return NextResponse.json({
      success: false,
      message: "Test user not found. Please sign up first with teste@gmail.com",
    })
  } catch (error) {
    console.error("Setup test user error:", error)
    return NextResponse.json({ success: false, error: "Failed to setup test user" }, { status: 500 })
  }
}
