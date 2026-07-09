import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ADMIN_TOKEN = "Admin123!"

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token")
  return token === ADMIN_TOKEN
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")

    if (type === "stats") {
      const [usersRes, depositsRes, withdrawalsRes, tradesRes, balancesRes, kycRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("deposits").select("amount, status"),
        supabase.from("withdrawals").select("amount, status"),
        supabase.from("trades").select("amount, profit, result, is_demo"),
        supabase.from("user_balances").select("balance_real, balance_demo"),
        supabase.from("kyc_requests").select("status"),
      ])

      const totalUsers = usersRes.count || 0
      const deposits = depositsRes.data || []
      const totalDeposited = deposits
        .filter((d: any) => d.status === "completed" || d.status === "approved")
        .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0)
      const pendingDeposits = deposits.filter((d: any) => d.status === "pending").length

      const withdrawals = withdrawalsRes.data || []
      const totalWithdrawn = withdrawals
        .filter((w: any) => w.status === "completed" || w.status === "approved")
        .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)
      const pendingWithdrawals = withdrawals.filter((w: any) => w.status === "pending").length

      const trades = tradesRes.data || []
      const realTrades = trades.filter((t: any) => !t.is_demo)
      const totalTrades = realTrades.length
      const platformProfit =
        realTrades
          .filter((t: any) => t.result === "loss")
          .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) -
        realTrades
          .filter((t: any) => t.result === "win")
          .reduce((sum: number, t: any) => sum + Number(t.profit || 0), 0)

      const balances = balancesRes.data || []
      const totalBalanceReal = balances.reduce((sum: number, b: any) => sum + Number(b.balance_real || 0), 0)

      const kycRequests = kycRes.data || []
      const pendingKyc = kycRequests.filter((k: any) => k.status === "pending").length

      return NextResponse.json({
        totalUsers,
        totalDeposited,
        totalWithdrawn,
        totalTrades,
        platformProfit,
        pendingDeposits,
        pendingWithdrawals,
        totalBalanceReal,
        pendingKyc,
      })
    }

    if (type === "users") {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })

      if (profilesError) throw profilesError
      if (!profiles || profiles.length === 0) return NextResponse.json({ users: [] })

      const userIds = profiles.map((p: any) => p.id)
      const { data: balances } = await supabase.from("user_balances").select("*").in("user_id", userIds)

      const users = profiles.map((profile: any) => {
        const balance = balances?.find((b: any) => b.user_id === profile.id)
        return {
          ...profile,
          balance_real: balance?.balance_real || 0,
          balance_demo: balance?.balance_demo || 100,
        }
      })

      return NextResponse.json({ users })
    }

    if (type === "deposits") {
      const { data: deposits, error: depositsError } = await supabase
        .from("deposits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (depositsError) throw depositsError
      if (!deposits || deposits.length === 0) return NextResponse.json({ deposits: [] })

      const userIds = [...new Set(deposits.map((d: any) => d.user_id))]
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds)

      const depositsWithProfiles = deposits.map((deposit: any) => {
        const profile = profiles?.find((p: any) => p.id === deposit.user_id)
        return {
          ...deposit,
          user_name: profile?.full_name || "Usuario",
          user_email: profile?.email || "Email nao encontrado",
        }
      })

      return NextResponse.json({ deposits: depositsWithProfiles })
    }

    if (type === "withdrawals") {
      const { data: withdrawals, error: withdrawalsError } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (withdrawalsError) throw withdrawalsError
      if (!withdrawals || withdrawals.length === 0) return NextResponse.json({ withdrawals: [] })

      const userIds = [...new Set(withdrawals.map((w: any) => w.user_id))]
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds)

      const withdrawalsWithProfiles = withdrawals.map((withdrawal: any) => {
        const profile = profiles?.find((p: any) => p.id === withdrawal.user_id)
        return {
          ...withdrawal,
          user_name: profile?.full_name || "Usuario",
          user_email: profile?.email || "Email nao encontrado",
        }
      })

      return NextResponse.json({ withdrawals: withdrawalsWithProfiles })
    }

    if (type === "kyc") {
      const { data: kycRequests, error: kycError } = await supabase
        .from("kyc_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (kycError) throw kycError
      if (!kycRequests || kycRequests.length === 0) return NextResponse.json({ kycRequests: [] })

      const userIds = [...new Set(kycRequests.map((k: any) => k.user_id))]
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds)

      const kycWithProfiles = kycRequests.map((kyc: any) => {
        const profile = profiles?.find((p: any) => p.id === kyc.user_id)
        return {
          ...kyc,
          user_name: profile?.full_name || "Usuario",
          user_email: profile?.email || "Email nao encontrado",
        }
      })

      return NextResponse.json({ kycRequests: kycWithProfiles })
    }

    return NextResponse.json({ error: "Tipo invalido" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const supabase = getAdminClient()
    const body = await req.json()
    const { action, data: actionData } = body

    console.log("[v0] Admin action:", action)
    console.log("[v0] Body:", JSON.stringify(body))

    // Get the actual payload - it can be in body.data or directly in body
    const payload = actionData || body

    console.log("[v0] Payload:", JSON.stringify(payload))

    if (action === "update_balance") {
      const userId = payload.userId
      const balanceReal = payload.balanceReal ?? payload.balance_real
      const balanceDemo = payload.balanceDemo ?? payload.balance_demo
      
      const { error } = await supabase.from("user_balances").upsert(
        {
          user_id: userId,
          balance_real: Number(balanceReal) || 0,
          balance_demo: Number(balanceDemo) || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "update_user") {
      // Support both camelCase and snake_case field names from frontend
      const userId = payload.userId
      const fullName = payload.fullName ?? payload.full_name
      const phone = payload.phone
      const isBlocked = payload.isBlocked ?? payload.is_blocked
      const isVerified = payload.isVerified ?? payload.is_verified
      const isAffiliate = payload.isAffiliate ?? payload.is_affiliate
      const balanceReal = payload.balanceReal ?? payload.balance_real
      const balanceDemo = payload.balanceDemo ?? payload.balance_demo

      const updateData: any = {
        updated_at: new Date().toISOString(),
      }
      
      // Only update fields that are provided
      if (fullName !== undefined) updateData.full_name = fullName
      if (phone !== undefined) updateData.phone = phone
      if (isBlocked !== undefined) updateData.is_blocked = isBlocked
      if (isVerified !== undefined) updateData.is_verified = isVerified
      if (isAffiliate !== undefined) updateData.is_affiliate = isAffiliate

      // Se marcou como afiliado e ainda nao tem codigo, gerar um
      if (isAffiliate) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("affiliate_code")
          .eq("id", userId)
          .single()

        if (!currentProfile?.affiliate_code) {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
          let code = ""
          for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
          }
          updateData.affiliate_code = code
          updateData.affiliate_status = "active"
          updateData.affiliate_commission_percent = 77.0
          updateData.affiliate_balance = 0
          updateData.affiliate_total_earned = 0
          updateData.affiliate_total_referrals = 0
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId)
      if (error) throw error
      
      // Also update balance if provided
      if (balanceReal !== undefined || balanceDemo !== undefined) {
        const { error: balanceError } = await supabase.from("user_balances").upsert(
          {
            user_id: userId,
            balance_real: Number(balanceReal) || 0,
            balance_demo: Number(balanceDemo) || 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        if (balanceError) throw balanceError
      }
      
      return NextResponse.json({ success: true })
    }

    if (action === "approve_deposit") {
      const depositId = payload.depositId
      const userId = payload.userId
      const amount = payload.amount
      
      // Validar parâmetros obrigatórios
      if (!depositId || !userId || amount === undefined) {
        return NextResponse.json({ 
          error: "Parâmetros obrigatórios: depositId, userId, amount",
          received: { depositId, userId, amount }
        }, { status: 400 })
      }
      
      // Atualizar status do depósito para "approved" (status válido)
      const { data: depositData, error: depositError } = await supabase
        .from("deposits")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", depositId)
        .select()
      
      if (depositError) {
        return NextResponse.json({ error: "Erro ao atualizar depósito: " + depositError.message }, { status: 500 })
      }

      // Atualizar saldo do usuário
      const { data: currentBalance } = await supabase
        .from("user_balances")
        .select("balance_real")
        .eq("user_id", userId)
        .maybeSingle()
      
      const newBalance = (currentBalance?.balance_real || 0) + Number(amount)
      
      const { error: balanceError } = await supabase
        .from("user_balances")
        .upsert(
          { user_id: userId, balance_real: newBalance, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        )
      
      if (balanceError) {
        return NextResponse.json({ error: "Erro ao atualizar saldo: " + balanceError.message }, { status: 500 })
      }

      // Verificar se usuario foi indicado por afiliado e creditar comissao
      try {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("id", userId)
          .single()

        if (userProfile?.referred_by) {
          const { data: affiliateProfile } = await supabase
            .from("profiles")
            .select("id, affiliate_balance, affiliate_total_earned, affiliate_commission_percent")
            .eq("affiliate_code", userProfile.referred_by)
            .eq("is_affiliate", true)
            .single()

          if (affiliateProfile) {
            const commissionPercent = affiliateProfile.affiliate_commission_percent || 77
            const commissionAmount = Number(amount) * (commissionPercent / 100)

            await supabase
              .from("profiles")
              .update({
                affiliate_balance: (affiliateProfile.affiliate_balance || 0) + commissionAmount,
                affiliate_total_earned: (affiliateProfile.affiliate_total_earned || 0) + commissionAmount,
              })
              .eq("id", affiliateProfile.id)

            await supabase.from("affiliate_commissions").insert({
              affiliate_id: affiliateProfile.id,
              referred_user_id: userId,
              deposit_id: depositId,
              deposit_amount: Number(amount),
              commission_percent: commissionPercent,
              commission_amount: commissionAmount,
              created_at: new Date().toISOString(),
            }).catch(() => {})
          }
        }
      } catch (affiliateError) {
        // Nao falhar a aprovacao do deposito por erro de afiliado
      }

      return NextResponse.json({ success: true })
    }

    if (action === "reject_deposit") {
      const depositId = payload.depositId
      const { error } = await supabase
        .from("deposits")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", depositId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "approve_withdrawal") {
      const withdrawalId = payload.withdrawalId
      const userId = payload.userId
      const amount = payload.amount
      
      const { error: withdrawalError } = await supabase
        .from("withdrawals")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", withdrawalId)
      if (withdrawalError) throw withdrawalError
      
      const { data: currentBalance } = await supabase
        .from("user_balances")
        .select("balance_real")
        .eq("user_id", userId)
        .single()
      
      if (currentBalance) {
        const newBalance = Math.max(0, (currentBalance.balance_real || 0) - Number(amount))
        await supabase
          .from("user_balances")
          .update({ balance_real: newBalance, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
      }
      
      return NextResponse.json({ success: true })
    }

    if (action === "reject_withdrawal") {
      const withdrawalId = payload.withdrawalId
      const { error } = await supabase
        .from("withdrawals")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", withdrawalId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "approve_kyc") {
      const kycId = payload.kycId
      const userId = payload.userId
      
      console.log("[v0] approve_kyc received:", { kycId, userId, payload })
      
      if (!kycId || !userId) {
        console.log("[v0] Missing kycId or userId")
        return NextResponse.json({ error: "kycId e userId sao obrigatorios" }, { status: 400 })
      }
      
      // Update KYC request - only update status field to avoid column errors
      const { data: kycData, error: kycError } = await supabase
        .from("kyc_requests")
        .update({ status: "approved" })
        .eq("id", kycId)
        .select()
      
      console.log("[v0] KYC update result:", { kycData, kycError })
      
      if (kycError) {
        console.log("[v0] KYC update error:", kycError)
        return NextResponse.json({ error: "Erro ao atualizar KYC: " + kycError.message }, { status: 500 })
      }
      
      // Update profile - only update is_verified to avoid column errors
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", userId)
        .select()
      
      console.log("[v0] Profile update result:", { profileData, profileError })
      
      if (profileError) {
        console.log("[v0] Profile update error:", profileError)
        return NextResponse.json({ error: "Erro ao atualizar perfil: " + profileError.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true })
    }

    if (action === "reject_kyc") {
      const kycId = payload.kycId
      const userId = payload.userId
      const reason = payload.reason
      
      console.log("[v0] reject_kyc received:", { kycId, userId, reason })
      
      if (!kycId || !userId) {
        return NextResponse.json({ error: "kycId e userId sao obrigatorios" }, { status: 400 })
      }
      
      // Update KYC request - only update status field to avoid column errors
      const { data: kycData, error: kycError } = await supabase
        .from("kyc_requests")
        .update({ status: "rejected" })
        .eq("id", kycId)
        .select()
      
      console.log("[v0] KYC reject result:", { kycData, kycError })
      
      if (kycError) {
        console.log("[v0] KYC reject error:", kycError)
        return NextResponse.json({ error: "Erro ao rejeitar KYC: " + kycError.message }, { status: 500 })
      }
      
      // Update profile - only set is_verified to false
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .update({ is_verified: false })
        .eq("id", userId)
        .select()
      
      console.log("[v0] Profile reject result:", { profileData, profileError })
      
      if (profileError) {
        console.log("[v0] Profile reject error:", profileError)
        return NextResponse.json({ error: "Erro ao atualizar perfil: " + profileError.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 })
  } catch (error: any) {
    console.log("[v0] Admin API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
