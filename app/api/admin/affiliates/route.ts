import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

const ADMIN_TOKEN = "Admin123!"

function checkToken(request: Request) {
  const token = request.headers.get("x-admin-token")
  return token === ADMIN_TOKEN
}

export async function GET(request: Request) {
  try {
    if (!checkToken(request)) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Buscar todos os usuarios que sao afiliados
    const { data: affiliates, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_affiliate", true)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Buscar saques pendentes
    const { data: pendingWithdrawals } = await supabase
      .from("affiliate_withdrawals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    // Buscar saques ja processados (aprovados/recusados) - historico
    const { data: processedWithdrawals } = await supabase
      .from("affiliate_withdrawals")
      .select("*")
      .in("status", ["approved", "completed", "rejected"])
      .order("updated_at", { ascending: false })
      .limit(50)

    // Helper para anexar os dados do afiliado a cada saque
    const attachProfile = async (list: any[]) =>
      Promise.all(
        (list || []).map(async (w) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, affiliate_code")
            .eq("id", w.user_id)
            .single()
          return {
            ...w,
            profile: profile || null,
          }
        })
      )

    const withdrawalsWithProfile = await attachProfile(pendingWithdrawals || [])
    const processedWithProfile = await attachProfile(processedWithdrawals || [])

    // Calcular estatisticas
    const totalAffiliates = affiliates?.length || 0
    const activeAffiliates = affiliates?.filter((a) => a.affiliate_status === "active").length || 0
    const totalEarned = affiliates?.reduce((sum, a) => sum + (a.affiliate_total_earned || 0), 0) || 0
    const totalReferrals = affiliates?.reduce((sum, a) => sum + (a.affiliate_total_referrals || 0), 0) || 0

    // Formatar afiliados para o frontend
    const formattedAffiliates = (affiliates || []).map((a) => ({
      id: a.id,
      user_id: a.id,
      code: a.affiliate_code || "N/A",
      commission_rate: a.affiliate_commission_percent || 77,
      balance: a.affiliate_balance || 0,
      total_earned: a.affiliate_total_earned || 0,
      total_referrals: a.affiliate_total_referrals || 0,
      status: a.affiliate_status || "active",
      created_at: a.created_at,
      profiles: {
        full_name: a.full_name,
        email: a.email,
      },
    }))

    return NextResponse.json({
      affiliates: formattedAffiliates,
      pendingWithdrawals: withdrawalsWithProfile,
      processedWithdrawals: processedWithProfile,
      stats: {
        totalAffiliates,
        activeAffiliates,
        totalEarned,
        totalReferrals,
      },
    })
  } catch (error) {
    console.error("Erro ao buscar afiliados:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    if (!checkToken(request)) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { affiliateId, action, data } = await request.json()

    if (action === "update_commission") {
      const { error } = await supabase
        .from("profiles")
        .update({ affiliate_commission_percent: data.commission_rate })
        .eq("id", affiliateId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "update_status") {
      const { error } = await supabase
        .from("profiles")
        .update({ affiliate_status: data.status })
        .eq("id", affiliateId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "update_balance") {
      const { error } = await supabase
        .from("profiles")
        .update({ affiliate_balance: data.balance })
        .eq("id", affiliateId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "process_withdrawal") {
      const { withdrawalId, status } = data

      if (!withdrawalId) {
        return NextResponse.json({ error: "ID do saque nao informado" }, { status: 400 })
      }

      const { data: withdrawal, error: fetchError } = await supabase
        .from("affiliate_withdrawals")
        .select("*")
        .eq("id", withdrawalId)
        .single()

      if (fetchError || !withdrawal) {
        return NextResponse.json({ error: "Saque nao encontrado" }, { status: 404 })
      }

      // Se rejeitado, devolver o saldo ao afiliado
      if (status === "rejected") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("affiliate_balance")
          .eq("id", withdrawal.user_id)
          .single()

        await supabase
          .from("profiles")
          .update({
            affiliate_balance: (profile?.affiliate_balance || 0) + (withdrawal.amount || 0),
          })
          .eq("id", withdrawal.user_id)
      }

      const finalStatus = status === "completed" ? "approved" : status
      const { error: updateError } = await supabase
        .from("affiliate_withdrawals")
        .update({
          status: finalStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId)

      if (updateError) throw updateError

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 })
  } catch (error) {
    console.error("Erro ao atualizar afiliado:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
