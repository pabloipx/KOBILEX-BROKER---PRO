/**
 * API para listar todos os ativos OTC com preços em tempo real
 */

import { OTC_ASSETS, multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"

export const dynamic = "force-dynamic"

export async function GET() {
  // Garante que o engine está rodando
  if (!multiAssetEngine.isEngineRunning()) {
    multiAssetEngine.start()
  }

  // Coleta preços de todos os ativos
  const prices: Record<string, { price: number; change: number }> = {}

  for (const asset of OTC_ASSETS) {
    const currentPrice = multiAssetEngine.getCurrentPrice(asset.symbol)
    // Calcula variação percentual em relação ao preço base
    const change = ((currentPrice - asset.basePrice) / asset.basePrice) * 100
    prices[asset.symbol] = {
      price: currentPrice,
      change: Number(change.toFixed(2)),
    }
  }

  return Response.json({
    assets: OTC_ASSETS.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      icon: a.icon,
      basePrice: a.basePrice,
    })),
    prices,
    timestamp: Date.now(),
  })
}
