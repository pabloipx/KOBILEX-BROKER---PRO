import { NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"

// Senha de ativacao do Robo TRADER PRO (validada no servidor para nao ficar exposta no bundle).
const VALID_PASSWORD = "iabroker"
const MIN_DEPOSIT = 250

async function getSessionUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function getTotalDeposited(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("deposits")
    .select("amount")
    .eq("user_id", userId)
    .in("status", ["approved", "completed"])

  if (error) return null
  return (data ?? []).reduce((sum, d) => sum + Number(d.amount || 0), 0)
}

export async function GET() {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ eligible: false, error: "Faça login para ativar o robô" }, { status: 401 })
    }

    const totalDeposited = await getTotalDeposited(userId)
    if (totalDeposited === null) {
      return NextResponse.json({ eligible: false, error: "Erro ao verificar depósitos" }, { status: 500 })
    }

    return NextResponse.json(
      {
        eligible: totalDeposited >= MIN_DEPOSIT,
        totalDeposited,
        minDeposit: MIN_DEPOSIT,
        missing: Math.max(0, MIN_DEPOSIT - totalDeposited),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json({ eligible: false, error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const password = body?.password

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Digite a senha do robô" }, { status: 400 })
    }

    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Faça login para ativar o robô" }, { status: 401 })
    }

    const totalDeposited = await getTotalDeposited(userId)
    if (totalDeposited === null) {
      return NextResponse.json({ success: false, error: "Erro ao verificar depósitos" }, { status: 500 })
    }

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

    if (password.trim().toLowerCase() !== VALID_PASSWORD) {
      return NextResponse.json({ success: false, error: "Senha incorreta" }, { status: 401 })
    }

    return NextResponse.json({ success: true, message: "Robô ativado com sucesso" })
  } catch {
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 })
  }
}
