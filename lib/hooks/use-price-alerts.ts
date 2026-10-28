"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"

export type PriceAlert = {
  id: string
  symbol: string
  name: string
  price: number
  /** Dispara quando o preco cruza o alvo nessa direcao. */
  direction: "above" | "below"
  createdAt: number
}

export type TriggeredAlert = PriceAlert & { triggeredAt: number; hitPrice: number }

/**
 * Alertas de preco da sessao. So verifica precos enquanto houver alerta ativo
 * e pausa com a aba em segundo plano.
 */
export function usePriceAlerts(onTrigger?: (alert: TriggeredAlert) => void) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [triggered, setTriggered] = useState<TriggeredAlert[]>([])
  const alertsRef = useRef(alerts)
  alertsRef.current = alerts
  const onTriggerRef = useRef(onTrigger)
  onTriggerRef.current = onTrigger

  useEffect(() => {
    if (alerts.length === 0) return
    const id = setInterval(() => {
      if (document.hidden) return
      const hits: TriggeredAlert[] = []
      for (const a of alertsRef.current) {
        const p = multiAssetEngine.getCurrentPrice(a.symbol)
        if (!p || p <= 0) continue
        if ((a.direction === "above" && p >= a.price) || (a.direction === "below" && p <= a.price)) {
          hits.push({ ...a, triggeredAt: Date.now(), hitPrice: p })
        }
      }
      if (hits.length === 0) return
      const hitIds = new Set(hits.map((h) => h.id))
      setAlerts((prev) => prev.filter((a) => !hitIds.has(a.id)))
      setTriggered((prev) => [...hits, ...prev].slice(0, 20))
      hits.forEach((h) => onTriggerRef.current?.(h))
    }, 500)
    return () => clearInterval(id)
  }, [alerts.length])

  const addAlert = useCallback((symbol: string, name: string, price: number) => {
    const current = multiAssetEngine.getCurrentPrice(symbol)
    if (!Number.isFinite(price) || price <= 0 || !current) return false
    setAlerts((prev) => [
      ...prev,
      {
        id: `a${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        symbol,
        name,
        price,
        direction: price >= current ? "above" : "below",
        createdAt: Date.now(),
      },
    ])
    return true
  }, [])

  const removeAlert = useCallback((id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id)), [])
  const clearTriggered = useCallback(() => setTriggered([]), [])

  return { alerts, triggered, addAlert, removeAlert, clearTriggered }
}
