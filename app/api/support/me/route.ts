import { db, getCustomer, jsonError } from "@/lib/support/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  const client = db()
  const { data: conversations, error } = await client
    .from("support_conversations")
    .select("id, number, category, status, created_at, closed_at, assigned_agent_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) return jsonError("Não foi possível carregar o suporte agora.", 503)

  const conversation = conversations?.find((c) => c.status !== "completed") ?? conversations?.[0] ?? null
  if (!conversation) return Response.json({ userId: user.id, conversation: null, messages: [], unreadCount: 0 })

  const [{ data: messages }, { data: agent }] = await Promise.all([
    client
      .from("support_messages")
      .select("id, conversation_id, sender_id, sender_role, kind, message, created_at, read_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(500),
    conversation.assigned_agent_id
      ? client.from("support_agents").select("name").eq("id", conversation.assigned_agent_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const list = messages ?? []
  const unreadCount = list.filter((m) => m.sender_role !== "customer" && !m.read_at).length

  return Response.json({
    userId: user.id,
    conversation: {
      id: conversation.id,
      number: conversation.number,
      category: conversation.category,
      status: conversation.status,
      createdAt: conversation.created_at,
      closedAt: conversation.closed_at,
      agentName: agent?.name ?? null,
    },
    // O id do atendente não é exposto ao cliente.
    messages: list.map((m) => ({ ...m, sender_id: m.sender_role === "customer" ? m.sender_id : null })),
    unreadCount,
  })
}
