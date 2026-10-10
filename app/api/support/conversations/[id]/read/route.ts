import { STAFF_TOPIC } from "@/lib/support/constants"
import { UUID_RE, broadcast, db, getCustomer, jsonError } from "@/lib/support/server"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  const client = db()
  const { data: conversation } = await client
    .from("support_conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!conversation) return jsonError("Atendimento não encontrado.", 404)

  const { data: updated } = await client
    .from("support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .neq("sender_role", "customer")
    .is("read_at", null)
    .select("id")

  if (updated?.length) {
    await broadcast([{ topic: STAFF_TOPIC, event: "read", payload: { conversationId: id } }])
  }
  return Response.json({ ok: true })
}
