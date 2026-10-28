"use client"

import { useSyncExternalStore } from "react"

// Um unico timer por intervalo para todos os componentes (em vez de um setInterval por instancia),
// pausado com a aba em segundo plano. Assim todos os contadores atualizam no mesmo frame.
type Ticker = { now: number; listeners: Set<() => void>; id: ReturnType<typeof setInterval> | null }
const tickers = new Map<number, Ticker>()

function getTicker(ms: number) {
  let t = tickers.get(ms)
  if (!t) {
    t = { now: Date.now(), listeners: new Set(), id: null }
    tickers.set(ms, t)
  }
  return t
}

function start(t: Ticker, ms: number) {
  if (t.id != null || typeof document === "undefined" || document.hidden) return
  t.now = Date.now()
  t.id = setInterval(() => {
    t.now = Date.now()
    t.listeners.forEach((l) => l())
  }, ms)
}

function stop(t: Ticker) {
  if (t.id != null) clearInterval(t.id)
  t.id = null
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    tickers.forEach((t, ms) => {
      if (document.hidden) stop(t)
      else if (t.listeners.size) {
        start(t, ms)
        t.now = Date.now()
        t.listeners.forEach((l) => l())
      }
    })
  })
}

const noopSubscribe = () => () => {}

export function useNow(intervalMs = 1000, enabled = true) {
  const ticker = getTicker(intervalMs)
  return useSyncExternalStore(
    enabled
      ? (cb) => {
          ticker.listeners.add(cb)
          start(ticker, intervalMs)
          return () => {
            ticker.listeners.delete(cb)
            if (!ticker.listeners.size) stop(ticker)
          }
        }
      : noopSubscribe,
    () => ticker.now,
    () => ticker.now,
  )
}

export function formatClock(ms: number, withSeconds = false) {
  return new Date(ms).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  })
}

export function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}
