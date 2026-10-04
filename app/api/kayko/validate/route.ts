import { NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"

// Senha de ativacao do Robo TRADER PRO (validada no servidor para nao ficar exposta no bundle).
const VALID_PASSWORD = "iabroker"
const MIN_DEPOSIT = 250

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const password = body?.password

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Digite a senha do robô" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Faça login para ativar o robô" }, { status: 401 })
    }

    if (password.trim().toLowerCase() !== VALID_PASSWORD) {
      return NextResponse.json({ success: false, error: "Senha incorreta" }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: deposits, error } = await admin
      .from("deposits")
      .select("amount")
      .eq("user_id", user.id)
      .in("status", ["approved", "completed"])

    if (error) {
      return NextResponse.json({ success: false, error: "Erro ao verificar depósitos" }, { status: 500 })
    }

    const totalDeposited = (deposits ?? []).reduce((sum, d) => sum + Number(d.amount || 0), 0)

    if (totalDeposited < MIN_DEPOSIT) {
      const missing = (MIN_DEPOSIT - totalDeposited).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })
      return NextResponse.json(
        {
          success: false,
          code: "MIN_DEPOSIT",
          error: `Para usar o TRADER PRO é preciso ter depositado pelo menos R$ 250,00. Faltam ${missing}.`,
        },
        { status: 403 },
      )
    }

    return NextResponse.json({ success: true, message: "Robô ativado com sucesso" })
  } catch {
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 })
  }
}
