import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const supabase = createAdminClient()

    const testEmail = "teste@gmail.com"
    const testPassword = "12345"

    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === testEmail)

    if (existingUser) {
      // Ensure the password is in a known state for testing
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: testPassword,
        email_confirm: true,
      })

      const { error: balanceError } = await supabase.from("user_balances").upsert(
        {
          user_id: existingUser.id,
          balance: 1000.0,
          currency: "USD",
        },
        { onConflict: "user_id" },
      )

      if (balanceError) {
        console.error("[v0] Balance error:", balanceError)
      }

      return NextResponse.json({
        success: true,
        message: "Test user exists. Balance set to $1,000.",
        userId: existingUser.id,
      })
    }

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    })

    if (createError) {
      console.error("[v0] Create user error:", createError)
      return NextResponse.json({ success: false, error: createError.message }, { status: 400 })
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: newUser.user.id,
        email: testEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )

    if (profileError) {
      console.error("[v0] Profile error:", profileError)
    }

    const { error: balanceError } = await supabase.from("user_balances").upsert(
      {
        user_id: newUser.user.id,
        balance: 1000.0,
        currency: "USD",
      },
      { onConflict: "user_id" },
    )

    if (balanceError) {
      console.error("[v0] Balance error:", balanceError)
    }

    return NextResponse.json({
      success: true,
      message: "Test user created successfully with $1,000 balance!",
      userId: newUser.user.id,
      email: testEmail,
    })
  } catch (error) {
    console.error("[v0] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return POST()
}
