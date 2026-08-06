import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

/**
 * Endpoint PUBLICO de sincronizacao de manipulacoes.
 *
 * O cliente (grafico) consulta este endpoint periodicamente e injeta as manipulacoes ativas
 * no motor de precos. Retornamos tambem as agendadas (start no futuro) para que o motor as
 * aplique automaticamente quando chegar a hora.
 *
 * IMPORTANTE: continuamos retornando manipulacoes JA terminadas durante a janela de "release".
 * Ao terminar, o motor dissolve o deslocamento aos poucos (cauda de ate 900s) para o preco
 * voltar ao normal sem salto. Se removessemos a manipulacao no instante do end_time, o motor
 * perderia a referencia e o drift cairia de todo o deslocamento para zero de uma vez — era isso
 * que fazia o grafico "subir/descer de uma vez" quando a manipulacao acabava. O motor ignora
 * sozinho (drift 0) qualquer manipulacao alem de end_time + release, entao basta olhar para tras
 * o release maximo (900s).
 */
const MAX_RELEASE_SECONDS = 900
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return NextResponse.json({ manipulations: [] })

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Inclui manipulacoes que terminaram ha ate MAX_RELEASE_SECONDS, para o motor conseguir
    // dissolver o deslocamento gradualmente (cauda de release) em vez de zerar de uma vez.
    const releaseCutoffIso = new Date(Date.now() - MAX_RELEASE_SECONDS * 1000).toISOString()
    const { data, error } = await supabase
      .from("otc_manipulations")
      .select("symbol, direction, start_time, end_time, strength, style")
      .eq("active", true)
      .gte("end_time", releaseCutoffIso)

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
