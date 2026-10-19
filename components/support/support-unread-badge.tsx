"use client"

import useSWR from "swr"
import { userTopic } from "@/lib/support/constants"
import { supportFetcher, useSupportSignal } from "@/lib/support/client"

export function SupportUnreadBadge() {
  const { data, mutate } = useSWR<{ userId: string | null; count: number }>("/api/support/unread", supportFetcher, {
    refreshInterval: 60_000,
  })
  useSupportSignal(data?.userId ? userTopic(data.userId) : null, () => {
    mutate()
  })

  const count = data?.count ?? 0
  if (!count) return null
  return (
    <span className="flex min-w-5 h-5 items-center justify-center rounded-full bg-[#f97316] px-1.5 text-[11px] font-bold text-white">
      {count > 99 ? "99+" : count}
      <span className="sr-only"> mensagens não lidas</span>
    </span>
  )
}
