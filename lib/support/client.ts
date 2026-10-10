"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export class SupportRequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function supportFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new SupportRequestError(data?.error || "Algo deu errado. Tente novamente.", res.status)
  return data as T
}

export const supportFetcher = <T,>(url: string) => supportFetch<T>(url)

export function newMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  )
}

/**
 * Escuta os sinais de tempo real de um tópico. Os eventos carregam apenas ids;
 * quem escuta revalida os dados pelas APIs autorizadas.
 */
export function useSupportSignal(topic: string | null, onSignal: (event: string, payload: Record<string, unknown>) => void) {
  const handler = useRef(onSignal)
  handler.current = onSignal

  useEffect(() => {
    if (!topic) return
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch {
      return
    }
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "*" }, (msg: { event: string; payload?: Record<string, unknown> }) =>
        handler.current(msg.event, msg.payload ?? {}),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [topic])
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
}

export function formatDayLabel(iso: string) {
  const tz = "America/Sao_Paulo"
  const day = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: tz })
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (day(date) === day(today)) return "Hoje"
  if (day(date) === day(yesterday)) return "Ontem"
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: tz })
}

export function isComposingEnter(e: React.KeyboardEvent) {
  return e.nativeEvent.isComposing || e.keyCode === 229
}
