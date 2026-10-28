"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, Info, Bell, Star } from "lucide-react"
import { useWatchlist } from "@/lib/hooks/use-watchlist"

type Candle = { open: number; close: number }

type Props = {
  symbol: string
  assetName: string
  assetLogo: string
  isOtc: boolean
  timeframe: number
  candles: Candle[]
  onOpenAssets: () => void
}

export function TraderoomChartOverlay({ symbol, assetName, assetLogo, isOtc, candles, onOpenAssets }: Props) {
  const watchlist = useWatchlist()
  const favorite = watchlist.has(symbol)
  const setFavorite = () => watchlist.toggle(symbol)
  const [alerts, setAlerts] = useState(false)

  return (
    <>
      <div className="absolute left-4 top-3 z-30 hidden lg:flex flex-col gap-3">
        <button type="button" onClick={onOpenAssets} className="flex items-center gap-3 text-left">
          <span className="relative h-8 w-8 overflow-hidden rounded-full ring-1 ring-tr-line">
            <Image src={assetLogo || "/placeholder.svg"} alt="" width={32} height={32} className="h-full w-full object-cover" />
          </span>
          <span className="flex flex-col">
            <span className="flex items-center gap-1 text-base font-medium text-tr-fg">
              {assetName}
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-xs text-tr-muted">{isOtc ? "Digital" : "Binária"}</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAssets}
            className="flex h-8 items-center gap-1.5 rounded-full bg-tr-raised px-2.5 text-xs font-semibold text-tr-fg hover:bg-tr-line transition-colors"
          >
            <Info className="w-4 h-4" aria-hidden="true" />
            Info
          </button>
          <button
            type="button"
            onClick={() => setAlerts((v) => !v)}
            aria-pressed={alerts}
            aria-label="Alertas de preço"
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-tr-raised transition-colors hover:bg-tr-line ${
              alerts ? "text-tr-brand" : "text-tr-muted"
            }`}
          >
            <Bell className="w-4 h-4" fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={setFavorite}
            aria-pressed={favorite}
            aria-label="Favoritar ativo"
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-tr-raised transition-colors hover:bg-tr-line ${
              favorite ? "text-tr-warn" : "text-tr-muted"
            }`}
          >
            <Star className="w-4 h-4" fill="currentColor" />
          </button>
        </div>
      </div>
    </>
  )
}
