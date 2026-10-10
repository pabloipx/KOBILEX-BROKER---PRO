import { UUID_RE, db, jsonError } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  const client = db()
  const { data: conversation } = await client
    .from("support_conversation_list")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!conversation) return jsonError("Atendimento não encontrado.", 404)

  const [messages, notes, profile, history] = await Promise.all([
    client
      .from("support_messages")
      .select("id, conversation_id, sender_id, sender_role, kind, message, created_at, read_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(1000),
    client
      .from("support_internal_notes")
      .select("id, note, created_at, admin_id, support_agents(name)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    client
      .from("profiles")
      .select("phone, country, kyc_status, is_verified, is_blocked, created_at")
      .eq("id", conversation.user_id)
      .maybeSingle(),
    client
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", conversation.user_id),
  ])

  const agentIds = [...new Set((messages.data ?? []).filter((m) => m.sender_role === "agent").map((m) => m.sender_id))]
  const { data: agents } = agentIds.length
    ? await client.from("support_agents").select("id, name").in("id", agentIds)
    : { data: [] as { id: string; name: string }[] }
  const agentNames = Object.fromEntries((agents ?? []).map((a) => [a.id, a.name]))

  return Response.json({
    conversation: { ...conversation, customer_total_conversations: history.count ?? 1 },
    profile: profile.data ?? null,
    messages: (messages.data ?? []).map((m) => ({
      ...m,
      sender_name: m.sender_role === "agent" ? (agentNames[m.sender_id as string] ?? "Atendente") : null,
    })),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      note: n.note,
      created_at: n.created_at,
      author: (n.support_agents as unknown as { name: string } | null)?.name ?? "Equipe",
    })),
  })
}
