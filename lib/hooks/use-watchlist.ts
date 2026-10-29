"use client"

import { useCallback, useSyncExternalStore } from "react"

// Preferencia de interface (ativos favoritos) — fica no navegador, como a ordem das abas.
const KEY = "tr:watchlist"
const EVENT = "tr:watchlist-change"
const EMPTY: string[] = []
let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY }

function read(): string[] {
  if (typeof window === "undefined") return EMPTY
  const raw = window.localStorage.getItem(KEY)
  if (raw === cache.raw) return cache.list
  let list: string[] = EMPTY
  try {
    const parsed = raw ? JSON.parse(raw) : []
    list = Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : EMPTY
  } catch {}
  cache = { raw, list }
  return list
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

export function useWatchlist() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY)
  const toggle = useCallback((symbol: string) => {
    const current = read()
    const next = current.includes(symbol) ? current.filter((s) => s !== symbol) : [...current, symbol]
    window.localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return { list, has: (s: string) => list.includes(s), toggle }
}
