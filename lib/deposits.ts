import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Aprova um deposito de forma idempotente: marca como "approved", credita o saldo do usuario,
 * registra a transacao e processa a comissao do afiliado.
 *
 * Reutilizado tanto pelo webhook da AmploPay quanto pela verificacao ativa de status (polling).
 * Retorna { approved: true } se creditou agora, ou { approved: false, alreadyProcessed: true }
 * se o deposito ja havia sido aprovado.
 */
export async function approveDeposit(
  supabaseAdmin: SupabaseClient,
  deposit: { id: string; user_id: string; amount: number; status: string; payment_reference?: string | null },
  providerTransactionId?: string,
): Promise<{ approved: boolean; alreadyProcessed?: boolean; newBalance?: number }> {
  // Idempotencia: se ja foi aprovado, nao credita de novo
  if (deposit.status === "approved") {
    return { approved: false, alreadyProcessed: true }
  }

  // 1. Marcar deposito como aprovado
  const { error: updateError } = await supabaseAdmin
    .from("deposits")
    .update({
      status: "approved",
      completed_at: new Date().toISOString(),
      payment_reference: providerTransactionId || deposit.payment_reference || null,
    })
    .eq("id", deposit.id)
    .eq("status", "pending") // guarda contra corrida: so atualiza se ainda estiver pendente

  if (updateError) {
    throw new Error(`Erro ao atualizar deposito: ${updateError.message}`)
  }

  // 2. Creditar saldo do usuario
  const { data: balance } = await supabaseAdmin
    .from("user_balances")
    .select("balance_real")
    .eq("user_id", deposit.user_id)
    .maybeSingle()

  const currentBalance = balance?.balance_real || 0
  const newBalance = currentBalance + deposit.amount

  const { error: balanceError } = await supabaseAdmin.from("user_balances").upsert(
    {
      user_id: deposit.user_id,
      balance_real: newBalance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (balanceError) {
    throw new Error(`Erro ao atualizar saldo: ${balanceError.message}`)
  }

  // 3. Registrar transacao
  await supabaseAdmin.from("transactions").insert({
    user_id: deposit.user_id,
    type: "deposit",
    amount: deposit.amount,
    status: "completed",
    description: "Deposito via PIX",
  })

  // 4. Processar comissao do afiliado
  try {
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("id", deposit.user_id)
      .single()

    if (userProfile?.referred_by) {
      const { data: affiliate } = await supabaseAdmin
        .from("profiles")
        .select("id, affiliate_commission_percent, affiliate_balance, affiliate_total_earned")
        .eq("affiliate_code", userProfile.referred_by)
        .eq("is_affiliate", true)
        .eq("affiliate_status", "active")
        .single()

      if (affiliate) {
        const commissionPercent = affiliate.affiliate_commission_percent || 77
        const commissionAmount = deposit.amount * (commissionPercent / 100)

        const { data: existingCommission } = await supabaseAdmin
          .from("affiliate_commissions")
          .select("id")
          .eq("deposit_id", deposit.id)
          .single()

        if (!existingCommission) {
          await supabaseAdmin.from("affiliate_commissions").insert({
            affiliate_id: affiliate.id,
            referred_user_id: deposit.user_id,
            deposit_id: deposit.id,
            deposit_amount: deposit.amount,
            commission_percent: commissionPercent,
            commission_amount: commissionAmount,
          })

          await supabaseAdmin
            .from("profiles")
            .update({
              affiliate_balance: (affiliate.affiliate_balance || 0) + commissionAmount,
              affiliate_total_earned: (affiliate.affiliate_total_earned || 0) + commissionAmount,
            })
            .eq("id", affiliate.id)
        }
      }
    }
  } catch (affiliateError) {
    // Nao falha o pagamento por causa da comissao
    console.error("[v0] Erro ao processar comissao do afiliado:", affiliateError)
  }

  return { approved: true, newBalance }
}

/** Status da AmploPay que indicam pagamento confirmado */
export function isPaidStatus(status?: string): boolean {
  if (!status) return false
  const s = status.toUpperCase()
  return s === "PAID" || s === "OK" || s === "COMPLETED" || s === "APPROVED"
}
