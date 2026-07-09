"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Candle, OTCAsset, PriceUpdate, Trade } from "@/lib/price-engine/types"
import { OTC_ASSETS, getAssetBySymbol } from "@/lib/otc-assets"
import { getClientPriceManager } from "@/lib/price-engine/client-price-manager"

export function useTrading() {
  const [selectedAsset, setSelectedAsset] = useState<OTCAsset>(OTC_ASSETS[0])
  const [currentPrice, setCurrentPrice] = useState(selectedAsset.basePrice)
  const [priceChange, setPriceChange] = useState(0)
  const [timeframe, setTimeframe] = useState(60)
  const [candles, setCandles] = useState<Candle[]>([])
  const [isDemo, setIsDemo] = useState(true)
  const [balance, setBalance] = useState({ real: 0, demo: 1000 }) // Saldo inicial: R$1.000 demo, R$0 real
  const [activeTrades, setActiveTrades] = useState<Trade[]>([])
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([])

  const priceManagerRef = useRef(getClientPriceManager())

  // Initialize and start price manager
  useEffect(() => {
    const pm = priceManagerRef.current
    pm.start()

    // Set initial candles
    setCandles(pm.getCandles(selectedAsset.symbol, timeframe))

    // Subscribe to price updates
    const unsubPrice = pm.onPriceUpdate((update: PriceUpdate) => {
      if (update.symbol === selectedAsset.symbol) {
        setCurrentPrice(update.price)
        setPriceChange(update.changePercent)
      }
    })

    // Subscribe to candle updates
    const unsubCandle = pm.onCandleUpdate((symbol: string, tf: number, candle: Candle) => {
      if (symbol === selectedAsset.symbol && tf === timeframe) {
        setCandles(pm.getCandles(symbol, tf))
      }
    })

    return () => {
      unsubPrice()
      unsubCandle()
    }
  }, [selectedAsset.symbol, timeframe])

  // Process active trades
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      setActiveTrades((trades) => {
        const stillActive: Trade[] = []
        const completed: Trade[] = []

        for (const trade of trades) {
          if (now >= trade.expiryTime) {
            const exitPrice = priceManagerRef.current.getPrice(trade.symbol)
            const won =
              (trade.direction === "call" && exitPrice > trade.entryPrice) ||
              (trade.direction === "put" && exitPrice < trade.entryPrice)

            const tie = exitPrice === trade.entryPrice

            const result = tie ? "tie" : won ? "win" : "loss"
            const profit = tie ? 0 : won ? trade.amount * (trade.payout / 100) : -trade.amount

            completed.push({
              ...trade,
              exitPrice,
              result,
              profit,
            })

            // Update balance
            setBalance((prev) => {
              const key = trade.isDemo ? "demo" : "real"
              return {
                ...prev,
                [key]: prev[key] + trade.amount + profit,
              }
            })
          } else {
            stillActive.push(trade)
          }
        }

        if (completed.length > 0) {
          setTradeHistory((prev) => [...completed, ...prev].slice(0, 50))
        }

        return stillActive
      })
    }, 100)

    return () => clearInterval(interval)
  }, [])

  const selectAsset = useCallback(
    (symbol: string) => {
      const asset = getAssetBySymbol(symbol)
      if (asset) {
        setSelectedAsset(asset)
        setCurrentPrice(priceManagerRef.current.getPrice(symbol) || asset.basePrice)
        setCandles(priceManagerRef.current.getCandles(symbol, timeframe))
      }
    },
    [timeframe],
  )

  const changeTimeframe = useCallback(
    (tf: number) => {
      setTimeframe(tf)
      setCandles(priceManagerRef.current.getCandles(selectedAsset.symbol, tf))
    },
    [selectedAsset.symbol],
  )

  const placeTrade = useCallback(
    (direction: "call" | "put", amount: number, duration: number) => {
      const balanceKey = isDemo ? "demo" : "real"

      if (balance[balanceKey] < amount) {
        return { success: false, error: "Saldo insuficiente" }
      }

      const now = Date.now()
      const trade: Trade = {
        id: `${now}-${Math.random().toString(36).substr(2, 9)}`,
        symbol: selectedAsset.symbol,
        direction,
        amount,
        entryPrice: currentPrice,
        entryTime: now,
        expiryTime: now + duration * 1000,
        timeframe: duration,
        payout: selectedAsset.payout,
        result: "pending",
        isDemo,
      }

      // Deduct from balance
      setBalance((prev) => ({
        ...prev,
        [balanceKey]: prev[balanceKey] - amount,
      }))

      setActiveTrades((prev) => [...prev, trade])

      return { success: true, trade }
    },
    [selectedAsset, currentPrice, isDemo, balance],
  )

  return {
    // Asset
    selectedAsset,
    selectAsset,
    assets: OTC_ASSETS,

    // Price
    currentPrice,
    priceChange,
    candles,

    // Timeframe
    timeframe,
    changeTimeframe,

    // Account
    isDemo,
    setIsDemo,
    balance,

    // Trading
    placeTrade,
    activeTrades,
    tradeHistory,
  }
}
