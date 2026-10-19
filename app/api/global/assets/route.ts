/**
 * Lista todos os ativos com o preco corrente.
 *
 * Duas origens, conforme a natureza do ativo:
 *  - OTC: motor sintetico deterministico (multiAssetEngine), inalterado.
 *  - Mercado aberto: ultimo preco REAL gravado pelo historico de ticks. O feed de precos roda
 *    no navegador, entao no servidor o store esta vazio; sem isto os ativos reais caiam no
 *    gerador sintetico e a lista mostrava um numero diferente do grafico.
 */

import { OTC_ASSETS, multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import { isRealSymbol } from "@/lib/price-engine/real-price-store"
import { getRecordedSnapshots } from "@/lib/price-engine/tick-recorder"

export const dynamic = "force-dynamic"

// Partes estaticas calculadas uma unica vez por instancia, e nao a cada requisicao.
const REAL_ASSETS = OTC_ASSETS.filter((a) => isRealSymbol(a.symbol))
const REAL_SYMBOLS = REAL_ASSETS.map((a) => a.symbol)
const SYNTHETIC_ASSETS = OTC_ASSETS.filter((a) => !isRealSymbol(a.symbol))
const ASSET_LIST = OTC_ASSETS.map((a) => ({
  symbol: a.symbol,
  name: a.name,
  icon: a.icon,
  basePrice: a.basePrice,
}))

// Todo cliente consulta esta rota a cada 3s. A resposta e a mesma para todos, entao uma unica
// montagem serve todas as requisicoes da janela; requisicoes simultaneas esperam a mesma promessa.
const TTL_MS = 2000
let cached: { body: string; at: number } | null = null
let inFlight: Promise<string> | null = null

const round2 = (n: number) => Math.round(n * 100) / 100

async function build(): Promise<string> {
  const snapshots = await getRecordedSnapshots(REAL_SYMBOLS).catch(
    () => new Map<string, { price: number; first: number }>(),
  )

  const prices: Record<string, { price: number; change: number }> = {}

  for (const asset of REAL_ASSETS) {
    const snap = snapshots.get(asset.symbol)
    if (!snap) {
      // Sem tick gravado: preco 0 sinaliza "sem cotacao" — nada e inventado no lugar.
      prices[asset.symbol] = { price: 0, change: 0 }
      continue
    }
    const factor = 10 ** asset.decimals
    prices[asset.symbol] = {
      price: Math.round(snap.price * factor) / factor,
      change: snap.first > 0 ? round2(((snap.price - snap.first) / snap.first) * 100) : 0,
    }
  }

  for (const asset of SYNTHETIC_ASSETS) {
    const price = multiAssetEngine.getCurrentPrice(asset.symbol)
    prices[asset.symbol] = {
      price,
      change: round2(((price - asset.basePrice) / asset.basePrice) * 100),
    }
  }

  return JSON.stringify({ assets: ASSET_LIST, prices, timestamp: Date.now() })
}

const HEADERS = {
  "Content-Type": "application/json",
  // A CDN da Vercel responde a maior parte das consultas sem invocar a funcao.
  "Cache-Control": "public, max-age=0, s-maxage=2, stale-while-revalidate=5",
}

export async function GET() {
  const now = Date.now()
  if (cached && now - cached.at < TTL_MS) {
    return new Response(cached.body, { headers: HEADERS })
  }

  if (!inFlight) {
    inFlight = build()
      .then((body) => {
        cached = { body, at: Date.now() }
        return body
      })
      .finally(() => {
        inFlight = null
      })
  }

  return new Response(await inFlight, { headers: HEADERS })
}
