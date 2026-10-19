import { getCustomer, jsonError, query, queryOne } from "@/lib/support/server"

export const dynamic = "force-dynamic"

type ConversationRow = {
  id: string
  number: string
  category: string | null
  status: string
  created_at: string
  closed_at: string | null
  assigned_agent_id: string | null
}

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role: string
  kind: string
  message: string
  created_at: string
  read_at: string | null
}

export async function GET() {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  try {
    const conversations = await query<ConversationRow>(
      `select id, number, category, status, created_at, closed_at, assigned_agent_id
       from support_conversations where user_id = $1 order by created_at desc limit 5`,
      [user.id],
    )

    const conversation = conversations.find((c) => c.status !== "completed") ?? conversations[0] ?? null
    if (!conversation) return Response.json({ userId: user.id, conversation: null, messages: [], unreadCount: 0 })

    const [messages, agent] = await Promise.all([
      query<MessageRow>(
        `select id, conversation_id, sender_id, sender_role, kind, message, created_at, read_at
         from support_messages where conversation_id = $1 order by created_at asc limit 500`,
        [conversation.id],
      ),
      conversation.assigned_agent_id
        ? queryOne<{ name: string }>("select name from support_agents where id = $1", [conversation.assigned_agent_id])
        : Promise.resolve(null),
    ])

    const unreadCount = messages.filter((m) => m.sender_role !== "customer" && !m.read_at).length

    return Response.json({
      userId: user.id,
      conversation: {
        id: conversation.id,
        number: Number(conversation.number),
        category: conversation.category,
        status: conversation.status,
        createdAt: conversation.created_at,
        closedAt: conversation.closed_at,
        agentName: agent?.name ?? null,
      },
      // O id do atendente não é exposto ao cliente.
      messages: messages.map((m) => ({ ...m, sender_id: m.sender_role === "customer" ? m.sender_id : null })),
      unreadCount,
    })
  } catch (error) {
    console.error("[support] falha ao carregar atendimento:", (error as Error).message)
    return jsonError("Não foi possível carregar o suporte agora.", 503)
  }
}
