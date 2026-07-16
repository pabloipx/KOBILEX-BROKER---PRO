import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

/**
 * Endpoint PUBLICO de sincronizacao de manipulacoes.
 *
 * O cliente (grafico) consulta este endpoint periodicamente e injeta as manipulacoes ativas
 * no motor de precos. Retornamos tambem as agendadas (start no futuro) para que o motor as
 * aplique automaticamente quando chegar a hora. So filtramos as que ja terminaram.
 */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return NextResponse.json({ manipulations: [] })

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from("otc_manipulations")
      .select("symbol, direction, start_time, end_time, strength, style")
      .eq("active", true)
      .gte("end_time", nowIso)

    if (error) return NextResponse.json({ manipulations: [] })

    const manipulations = (data || []).map((m: any) => ({
      symbol: m.symbol,
      direction: m.direction,
      startTime: Math.floor(new Date(m.start_time).getTime() / 1000),
      endTime: Math.floor(new Date(m.end_time).getTime() / 1000),
      strength: Number(m.strength) || 60,
      style: m.style || "natural",
    }))

    return NextResponse.json({ manipulations })
  } catch {
    return NextResponse.json({ manipulations: [] })
  }
}
