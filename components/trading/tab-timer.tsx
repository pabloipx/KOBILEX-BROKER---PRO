"use client"

import { memo, useEffect, useState } from "react"
import { Clock } from "lucide-react"

type Props = {
  expiresAt: number | undefined
  isOtc: boolean
}

function secondsLeft(expiresAt: number | undefined) {
  if (expiresAt === undefined) return 0
  return Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
}

function formatRemaining(remaining: number) {
  return remaining >= 60
    ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
    : `:${String(remaining).padStart(2, "0")}`
}

// The countdown ticks inside this leaf so only the tab label re-renders every 500ms,
// instead of the whole trade page (chart included).
export const TabTimer = memo(function TabTimer({ expiresAt, isOtc }: Props) {
  const [remaining, setRemaining] = useState(() => secondsLeft(expiresAt))

  useEffect(() => {
    setRemaining(secondsLeft(expiresAt))
    if (expiresAt === undefined) return
    const id = setInterval(() => {
      const next = secondsLeft(expiresAt)
      setRemaining((prev) => (prev === next ? prev : next))
      if (next <= 0) clearInterval(id)
    }, 500)
    return () => clearInterval(id)
  }, [expiresAt])

  if (remaining <= 0) {
    return isOtc ? <p className="text-gray-500 text-[10px] leading-tight">Binária</p> : null
  }

  const urgent = remaining <= 10
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold leading-tight tabular-nums ${
        urgent ? "text-red-400" : "text-[#ff8a00]"
      }`}
    >
      <Clock className={`w-3 h-3 ${urgent ? "animate-pulse" : ""}`} aria-hidden="true" />
      {formatRemaining(remaining)}
    </span>
  )
})
