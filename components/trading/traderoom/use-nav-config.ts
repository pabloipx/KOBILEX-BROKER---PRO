"use client"

import { useCallback, useSyncExternalStore } from "react"
import type { NavItemId } from "./traderoom-nav"

export type NavConfigEntry = { id: NavItemId; visible: boolean }

const STORAGE_KEY = "traderoom:nav-config:v1"

const DEFAULT_CONFIG: NavConfigEntry[] = [
  { id: "portfolio", visible: true },
  { id: "history", visible: true },
  { id: "chat", visible: true },
  { id: "tournaments", visible: true },
  { id: "leaders", visible: true },
  { id: "promo", visible: true },
  { id: "tutorials", visible: true },
  { id: "analysis", visible: true },
  { id: "help", visible: false },
  { id: "alerts", visible: false },
]

let current: NavConfigEntry[] = DEFAULT_CONFIG
let loaded = false
const listeners = new Set<() => void>()

// Preferencia de layout (apenas visual) - fica no navegador do usuario.
function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as NavConfigEntry[]
    const known = new Set(DEFAULT_CONFIG.map((e) => e.id))
    const valid = parsed.filter((e) => known.has(e.id))
    const missing = DEFAULT_CONFIG.filter((d) => !valid.some((e) => e.id === d.id))
    current = [...valid, ...missing].map((e) => (e.id === "portfolio" ? { ...e, visible: true } : e))
  } catch {}
}

function save(next: NavConfigEntry[]) {
  current = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {}
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  load()
  listeners.add(cb)
  cb()
  return () => listeners.delete(cb)
}

export function useNavConfig() {
  const config = useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_CONFIG,
  )

  const toggle = useCallback((id: NavItemId) => {
    if (id === "portfolio") return
    save(current.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)))
  }, [])

  const move = useCallback((from: number, to: number) => {
    if (from === to || to < 0 || to >= current.length) return
    const next = [...current]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    save(next)
  }, [])

  return { config, toggle, move }
}
