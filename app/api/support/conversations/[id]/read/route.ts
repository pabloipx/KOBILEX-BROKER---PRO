import { STAFF_TOPIC } from "@/lib/support/constants"
import { UUID_RE, broadcast, getCustomer, jsonError, query, queryOne, supportError } from "@/lib/support/server"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  try {
    const conversation = await queryOne("select id from support_conversations where id = $1 and user_id = $2", [
      id,
      user.id,
    ])
    if (!conversation) return jsonError("Atendimento não encontrado.", 404)

    const updated = await query(
      `update support_messages set read_at = now()
       where conversation_id = $1 and sender_role <> 'customer' and read_at is null
       returning id`,
      [id],
    )
    if (updated.length) {
      await broadcast([{ topic: STAFF_TOPIC, event: "read", payload: { conversationId: id } }])
    }
    return Response.json({ ok: true })
  } catch (error) {
    return supportError(error as Error)
  }
}
