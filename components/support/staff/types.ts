import type { SupportMessage } from "@/lib/support/constants"

export type StaffInfo = { id: string; name: string; email: string; role: "admin" | "agent" }

export type ConversationItem = {
  id: string
  number: number
  user_id: string
  account_id: string | null
  category: string | null
  status: string
  assigned_agent_id: string | null
  assigned_agent_name: string | null
  last_message_preview: string | null
  last_message_at: string | null
  created_at: string
  closed_at: string | null
  closed_by_name: string | null
  customer_name: string | null
  customer_username: string | null
  customer_email?: string | null
  unread_count: number
}

export type Stats = {
  total: number
  new: number
  waiting_agent: number
  in_progress: number
  waiting_customer: number
  completed: number
  unread: number
}

export type ListResponse = { staff: StaffInfo; items: ConversationItem[]; stats: Stats }

export type DetailResponse = {
  conversation: ConversationItem & { customer_total_conversations: number }
  profile: {
    phone: string | null
    country: string | null
    kyc_status: string | null
    is_verified: boolean | null
    is_blocked: boolean | null
    created_at: string | null
  } | null
  messages: (SupportMessage & { sender_name: string | null })[]
  notes: { id: string; note: string; created_at: string; author: string }[]
}

export type Agent = { id: string; name: string; email?: string; role: "admin" | "agent"; active: boolean }

export type Filters = {
  view: "active" | "completed"
  q: string
  category: string
  status: string
  from: string
  to: string
}
