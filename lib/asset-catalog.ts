import { OTC_ASSETS } from "@/lib/price-engine/multi-asset-engine"

export interface AssetUIInfo {
  symbol: string
  name: string
  category: "forex" | "crypto" | "stocks"
  payout: number
  logo: string
}

/**
 * Metadados de UI (nome de exibição, categoria, payout e logo) por símbolo.
 * A fonte de verdade dos preços continua sendo OTC_ASSETS no price engine.
 */
const ASSET_UI: Record<string, Omit<AssetUIInfo, "symbol">> = {
  EURUSD_OTC: { name: "EUR/USD (OTC)", category: "forex", payout: 96, logo: "/images/a1640800-8419-484d-9351.jpeg" },
  GBPUSD_OTC: { name: "GBP/USD (OTC)", category: "forex", payout: 96, logo: "/images/5c13c1c5-2d6b-4006-b117.jpeg" },
  USDJPY_OTC: { name: "USD/JPY (OTC)", category: "forex", payout: 96, logo: "/images/06fd67b4-821f-4dad-9daf.jpeg" },
  AUDUSD_OTC: { name: "AUD/USD (OTC)", category: "forex", payout: 96, logo: "/images/82329959-774d-46ff-b731.jpeg" },
  BTCUSD_OTC: { name: "BTC/USD (OTC)", category: "crypto", payout: 96, logo: "/images/a8ba8d63-a559-42c6-955c.jpeg" },
  USDBRL_OTC: { name: "USD/BRL (OTC)", category: "forex", payout: 92, logo: "/images/assets/usdbrl-otc.png" },
  SPACEX_OTC: { name: "SpaceXCoin (OTC)", category: "crypto", payout: 90, logo: "/images/assets/spacex-otc.png" },
  TRUMP_OTC: { name: "TRUMP Coin (OTC)", category: "crypto", payout: 90, logo: "/images/assets/trump-otc.png" },
  AMZN_OTC: { name: "Amazon (OTC)", category: "stocks", payout: 92, logo: "/images/assets/amzn-otc.png" },
  PENUSD_OTC: { name: "PEN/USD (OTC)", category: "forex", payout: 92, logo: "/images/assets/penusd-otc.png" },
  ONDO_OTC: { name: "Ondo (OTC)", category: "crypto", payout: 90, logo: "/images/assets/ondo-otc.png" },
  SHIBUSD_OTC: { name: "SHIB/USD (OTC)", category: "crypto", payout: 90, logo: "/images/assets/shib-otc.png" },
  TSLA_OTC: { name: "Tesla (OTC)", category: "stocks", payout: 92, logo: "/images/assets/tsla-otc.png" },
  PEPE_OTC: { name: "Pepe (OTC)", category: "crypto", payout: 90, logo: "/images/assets/pepe-otc.png" },
  META_OTC: { name: "Meta (OTC)", category: "stocks", payout: 92, logo: "/images/assets/meta-otc.png" },
  DOGE_OTC: { name: "DogeCoin (OTC)", category: "crypto", payout: 90, logo: "/images/assets/doge-otc.png" },
}

const FALLBACK_LOGO = "/placeholder.svg"

/** Catálogo completo (todos os ativos existentes no price engine + metadados de UI). */
export const ASSET_CATALOG: AssetUIInfo[] = OTC_ASSETS.map((a) => {
  const ui = ASSET_UI[a.symbol]
  return {
    symbol: a.symbol,
    name: ui?.name || a.name,
    category: ui?.category || "forex",
    payout: ui?.payout ?? 90,
    logo: ui?.logo || FALLBACK_LOGO,
  }
})

export function getAssetUI(symbol: string): AssetUIInfo | undefined {
  return ASSET_CATALOG.find((a) => a.symbol === symbol)
}
