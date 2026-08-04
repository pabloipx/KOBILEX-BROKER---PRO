import { createAdminClient } from "@/lib/supabase/admin"
import type { RealCandle } from "./real-price-store"

// Construcao das velas de 1 MINUTO a partir dos ticks reais de mercado.
//
// Por que isso existe: nenhuma fonte gratuita entrega OHLC real de 1m para forex. O Yahoo
// devolve open=high=low=close em todos os minutos (vela sem corpo, grafico achatado) e o
// TradingView so expoe o preco atual, sem historico. Entao a plataforma faz o que uma
// corretora faz: recebe o fluxo de precos reais e monta as velas a partir dele.
//
// Todo valor gravado aqui e um preco real de mercado — nada e sintetizado.

const BUCKET = 60 // 1 minuto, em segundos

/** Inicio do minuto a que um instante pertence (em epoch/segundos) */
function bucketOf(tsMs: number): number {
  return Math.floor(tsMs / 1000 / BUCKET) * BUCKET
}

// Throttle por simbolo: o endpoint de preco e chamado a cada ~1,5s por cada usuario
// conectado. Sem isso, 100 usuarios gerariam ~67 gravacoes por segundo no mesmo simbolo,
// todas com o mesmo preco. Uma gravacao a cada 2s por simbolo ja da ~30 amostras por vela,
// resolucao mais que suficiente para o high/low do minuto.
const MIN_WRITE_INTERVAL_MS = 2000
const lastWrite = new Map<string, number>()

/**
 * Registra um preco real na vela do minuto corrente. Nao lanca excecao e nao deve ser
 * aguardado no caminho da resposta: a cotacao do usuario nunca pode ficar mais lenta (ou
 * falhar) por causa da gravacao do historico.
 */
export function recordTick(symbol: string, price: number): void {
  if (!Number.isFinite(price) || price <= 0) return

  const now = Date.now()
  const last = lastWrite.get(symbol) ?? 0
  if (now - last < MIN_WRITE_INTERVAL_MS) return
  lastWrite.set(symbol, now)

  const bucket = bucketOf(now)

  // A funcao record_market_tick faz um upsert atomico (greatest/least no proprio SQL),
  // entao gravacoes simultaneas de instancias diferentes nao perdem o high/low.
  void createAdminClient()
    .rpc("record_market_tick", { p_symbol: symbol, p_bucket: bucket, p_price: price })
    .then(({ error }) => {
      if (error) console.log("[v0] recordTick falhou:", symbol, error.message)
    })
}

/**
 * Le as velas de 1m acumuladas para um simbolo. Retorna vazio quando ainda nao ha
 * historico suficiente, para que quem chama possa recorrer a outra fonte.
 */
export async function getRecordedCandles(symbol: string, limit = 240): Promise<RealCandle[]> {
  const { data, error } = await createAdminClient()
    .from("market_candles_1m")
    .select("bucket_time, open, high, low, close")
    .eq("symbol", symbol)
    .order("bucket_time", { ascending: false })
    .limit(limit)

  if (error) {
    console.log("[v0] getRecordedCandles falhou:", symbol, error.message)
    return []
  }

  // Vem em ordem decrescente (para pegar as mais recentes) e o grafico espera crescente
  return (data ?? [])
    .map(r => ({
      time: Number(r.bucket_time),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    }))
    .reverse()
}
