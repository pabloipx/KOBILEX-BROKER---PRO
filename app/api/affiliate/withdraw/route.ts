import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const { amount, pixKey, pixKeyType } = await request.json()

    if (!amount || amount < 50) {
      return NextResponse.json({ error: "Valor minimo para saque e R$ 50,00" }, { status: 400 })
    }

    if (!pixKey || !pixKeyType) {
      return NextResponse.json({ error: "Chave PIX e obrigatoria" }, { status: 400 })
    }

    const admin = createAdminClient()

    // Buscar dados do perfil/afiliado via admin
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Perfil nao encontrado" }, { status: 404 })
    }

    if (!profile.is_affiliate) {
      return NextResponse.json({ error: "Voce nao e um afiliado" }, { status: 400 })
    }

    const currentBalance = profile.affiliate_balance || 0

    if (currentBalance < amount) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 })
    }

    // Taxa de saque de 2% (afiliado recebe 98% do valor solicitado)
    const fee = Math.round(amount * 0.02 * 100) / 100
    const netAmount = Math.round((amount - fee) * 100) / 100

    // Criar solicitacao de saque via admin
    const { data: withdrawal, error: withdrawalError } = await admin
      .from("affiliate_withdrawals")
      .insert({
        user_id: user.id,
        amount,
        fee,
        net_amount: netAmount,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        status: "pending",
      })
      .select()
      .single()

    if (withdrawalError) throw withdrawalError

    // Atualizar saldo do afiliado (reservar o valor)
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        affiliate_balance: currentBalance - amount,
      })
      .eq("id", user.id)

    if (updateError) throw updateError

    return NextResponse.json({ withdrawal })
  } catch (error) {
    console.error("Erro ao criar saque:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
