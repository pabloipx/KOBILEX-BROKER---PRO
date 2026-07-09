import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const supabase = createAdminClient()

    // Create test user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: "teste@gmail.com",
      password: "12345",
      email_confirm: true,
    })

    if (authError) {
      // If user already exists, just get their ID
      const { data: existingUser } = await supabase.auth.admin.listUsers()
      const testUser = existingUser?.users.find((u) => u.email === "teste@gmail.com")

      if (testUser) {
        const { error: balanceError } = await supabase.from("user_balances").upsert(
          {
            user_id: testUser.id,
            balance_real: 5000.0,
            balance_demo: 10000.0,
            currency: "USD",
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        )

        if (balanceError) {
          console.error("[v0] Error updating balance:", balanceError)
        }

        return NextResponse.json({
          success: true,
          message: "Test user already exists, balance updated",
          userId: testUser.id,
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create or find test user",
          details: authError.message,
        },
        { status: 400 },
      )
    }

    const userId = authData.user.id

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      email: "teste@gmail.com",
      full_name: "Usuário Teste",
      is_admin: true,
      is_verified: true,
      is_blocked: false,
    })

    if (profileError) {
      console.error("[v0] Profile creation error:", profileError)
    }

    const { error: balanceError } = await supabase.from("user_balances").insert({
      user_id: userId,
      balance_real: 5000.0,
      balance_demo: 10000.0,
      currency: "USD",
    })

    if (balanceError) {
      console.error("[v0] Balance creation error:", balanceError)
    }

    return NextResponse.json({
      success: true,
      message: "Test user created successfully",
      userId,
      credentials: {
        email: "teste@gmail.com",
        password: "12345",
      },
    })
  } catch (error) {
    console.error("[v0] Test user creation error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create test user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
