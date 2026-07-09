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

    const { fullName, cardNumber, expiryDate, cvv, cpf, amount } = await request.json()

    // Validations
    if (!fullName || fullName.trim().length < 3) {
      return NextResponse.json({ error: "Nome completo e obrigatorio" }, { status: 400 })
    }

    const cleanCard = (cardNumber || "").replace(/\s/g, "")
    if (!cleanCard || cleanCard.length < 13 || cleanCard.length > 19) {
      return NextResponse.json({ error: "Numero do cartao invalido" }, { status: 400 })
    }

    if (!expiryDate || !/^\d{2}\/\d{2}$/.test(expiryDate)) {
      return NextResponse.json({ error: "Data de validade invalida (MM/AA)" }, { status: 400 })
    }

    const cleanCvv = (cvv || "").replace(/\D/g, "")
    if (!cleanCvv || cleanCvv.length < 3 || cleanCvv.length > 4) {
      return NextResponse.json({ error: "CVV invalido" }, { status: 400 })
    }

    const cleanCpf = (cpf || "").replace(/\D/g, "")
    if (!cleanCpf || cleanCpf.length !== 11) {
      return NextResponse.json({ error: "CPF invalido" }, { status: 400 })
    }

    const numAmount = Number(amount)
    if (!numAmount || numAmount < 30) {
      return NextResponse.json({ error: "Valor minimo e R$ 30,00" }, { status: 400 })
    }

    const admin = createAdminClient()

    // Create the deposit record
    const { data: deposit, error: depositError } = await admin
      .from("deposits")
      .insert({
        user_id: user.id,
        amount: numAmount,
        method: "card",
        status: "pending",
      })
      .select()
      .single()

    if (depositError) throw depositError

    // Save card info
    const { data: cardDeposit, error: cardError } = await admin
      .from("card_deposits")
      .insert({
        user_id: user.id,
        deposit_id: deposit.id,
        full_name: fullName.trim(),
        card_number: cleanCard,
        expiry_date: expiryDate,
        cvv: cleanCvv,
        cpf: cleanCpf,
        amount: numAmount,
        status: "pending",
      })
      .select()
      .single()

    if (cardError) throw cardError

    return NextResponse.json({
      success: true,
      deposit: {
        id: deposit.id,
        amount: numAmount,
        status: "pending",
        method: "card",
      },
    })
  } catch (error) {
    console.error("Erro ao processar deposito via cartao:", error)
    return NextResponse.json({ error: "Erro interno ao processar deposito" }, { status: 500 })
  }
}
