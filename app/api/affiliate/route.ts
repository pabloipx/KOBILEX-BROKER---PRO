import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Obter dados do afiliado
export async function GET() {
  try {
    console.log("[v0] Affiliate GET - Starting")
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log("[v0] Affiliate GET - User:", user?.id)

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const admin = createAdminClient()

    // Buscar dados do perfil do usuario via admin (bypass RLS)
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.log("[v0] Affiliate GET - Profile error:", profileError)
      return NextResponse.json({ error: "Erro ao buscar perfil" }, { status: 500 })
    }
    
    console.log("[v0] Affiliate GET - Profile:", profile)

    // If profile doesn't exist yet, create it
    if (!profile) {
      const { error: insertError } = await admin
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
        })

      if (insertError) {
        return NextResponse.json({ error: "Erro ao criar perfil" }, { status: 500 })
      }

      return NextResponse.json({ affiliate: null })
    }

    if (!profile.is_affiliate) {
      return NextResponse.json({ affiliate: null })
    }

    // Buscar referidos via admin (cross-user query)
    const { data: referredUsers } = await admin
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("referred_by", profile.affiliate_code)
      .order("created_at", { ascending: false })

    // Para cada referido, buscar total de depositos aprovados
    const referralsWithDeposits = await Promise.all(
      (referredUsers || []).map(async (referredUser) => {
        const { data: deposits } = await admin
          .from("deposits")
          .select("amount")
          .eq("user_id", referredUser.id)
          .in("status", ["approved", "completed"])

        const totalDeposits = deposits?.reduce((sum, d) => sum + Number(d.amount), 0) || 0
        const commission = totalDeposits * ((profile.affiliate_commission_percent || 77) / 100)

        return {
          id: referredUser.id,
          referred_user_id: referredUser.id,
          status: totalDeposits > 0 ? "active" : "registered",
          total_deposits: totalDeposits,
          total_commission: commission,
          created_at: referredUser.created_at,
          profiles: {
            full_name: referredUser.full_name,
            email: referredUser.email,
          },
        }
      })
    )

    const totalReferrals = referralsWithDeposits.length
    const referralsWithDeposit = referralsWithDeposits.filter((r) => r.total_deposits > 0).length
    const totalEarned = referralsWithDeposits.reduce((sum, r) => sum + r.total_commission, 0)

    // Buscar historico de saques
    const { data: withdrawals } = await admin
      .from("affiliate_withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    return NextResponse.json({
      affiliate: {
        id: user.id,
        user_id: user.id,
        code: profile.affiliate_code,
        commission_rate: profile.affiliate_commission_percent || 77,
        balance: profile.affiliate_balance || 0,
        status: profile.affiliate_status || "active",
        total_earned: profile.affiliate_total_earned || totalEarned,
        total_referrals: totalReferrals,
        referrals_with_deposit: referralsWithDeposit,
      },
      referrals: referralsWithDeposits,
      withdrawals: withdrawals || [],
    })
  } catch (error) {
    console.log("[v0] Affiliate GET - Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}


// POST - Tornar-se afiliado
export async function POST() {
  try {
    console.log("[v0] Affiliate POST - Starting")
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log("[v0] Affiliate POST - User:", user?.id)

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const admin = createAdminClient()

    // Verificar se ja e afiliado (via admin to bypass RLS)
    const { data: profile } = await admin
      .from("profiles")
      .select("is_affiliate, affiliate_code, affiliate_commission_percent, affiliate_balance, affiliate_status")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.is_affiliate && profile?.affiliate_code) {
      return NextResponse.json({
        affiliate: {
          id: user.id,
          user_id: user.id,
          code: profile.affiliate_code,
          commission_rate: profile.affiliate_commission_percent || 77,
          balance: profile.affiliate_balance || 0,
          status: profile.affiliate_status || "active",
          total_earned: 0,
          total_referrals: 0,
          referrals_with_deposit: 0,
        },
      })
    }

    // If profile doesn't exist, create it first
    if (!profile) {
      const { error: insertError } = await admin.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
      })
      if (insertError) {
        return NextResponse.json({ error: "Erro ao criar perfil" }, { status: 500 })
      }
    }

    // Gerar codigo unico
    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
      let code = ""
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

    let code = generateCode()
    let attempts = 0

    // Verificar se codigo ja existe
    while (attempts < 10) {
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("affiliate_code", code)
        .maybeSingle()

      if (!existing) break
      code = generateCode()
      attempts++
    }

    // Atualizar perfil para ser afiliado (via admin to bypass RLS)
    const { data: updatedProfile, error } = await admin
      .from("profiles")
      .update({
        is_affiliate: true,
        affiliate_code: code,
        affiliate_status: "active",
        affiliate_commission_percent: 77.0,
        affiliate_balance: 0,
        affiliate_total_earned: 0,
        affiliate_total_referrals: 0,
      })
      .eq("id", user.id)
      .select()
      .single()

    if (error) {
      console.log("[v0] Affiliate POST - Update error:", error)
      return NextResponse.json({ error: "Erro ao ativar afiliado" }, { status: 500 })
    }

    console.log("[v0] Affiliate POST - Success:", updatedProfile)

    return NextResponse.json({
      affiliate: {
        id: user.id,
        user_id: user.id,
        code: updatedProfile.affiliate_code,
        commission_rate: updatedProfile.affiliate_commission_percent,
        balance: updatedProfile.affiliate_balance || 0,
        status: updatedProfile.affiliate_status,
        total_earned: 0,
        total_referrals: 0,
        referrals_with_deposit: 0,
      },
    })
  } catch (error) {
    console.log("[v0] Affiliate POST - Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
