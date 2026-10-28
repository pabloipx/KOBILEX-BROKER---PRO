"use client"

import { useEffect, useState } from "react"

export type Quote = {
  symbol: string
  price: number
  change: number
  decimals: number
  payout: number
}

const INITIAL: Quote[] = [
  { symbol: "EUR/USD", price: 1.0846, change: 0.06, decimals: 4, payout: 90 },
  { symbol: "BTC/USD", price: 62788.64, change: -0.17, decimals: 2, payout: 92 },
  { symbol: "Ouro", price: 2377.62, change: 0.13, decimals: 2, payout: 88 },
]

export function useLiveQuotes(intervalMs = 2500) {
  const [quotes, setQuotes] = useState<Quote[]>(INITIAL)

  useEffect(() => {
    const id = setInterval(() => {
      setQuotes((prev) =>
        prev.map((q) => {
          const drift = (Math.random() - 0.5) * 0.0006
          const price = q.price * (1 + drift)
          const change = Math.max(-0.5, Math.min(0.5, q.change + drift * 100))
          return { ...q, price, change }
        }),
      )
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return quotes
}

export function formatChange(change: number) {
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
}
