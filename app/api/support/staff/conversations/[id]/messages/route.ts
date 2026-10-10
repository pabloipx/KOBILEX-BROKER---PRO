import { MAX_MESSAGE_LENGTH, STAFF_TOPIC, userTopic } from "@/lib/support/constants"
import { UUID_RE, broadcast, db, jsonError, readJson, supportError } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  const body = await readJson(request)
  const messageId = typeof body?.id === "string" ? body.id : ""
  const text = typeof body?.message === "string" ? body.message.trim() : ""

  if (!UUID_RE.test(id) || !UUID_RE.test(messageId)) return jsonError("Requisição inválida.", 400)
  if (!text) return jsonError("A mensagem não pode ficar vazia.", 400)
  if (text.length > MAX_MESSAGE_LENGTH) return jsonError(`Limite de ${MAX_MESSAGE_LENGTH} caracteres.`, 400)

  const client = db()
  const { data, error } = await client.rpc("support_post_message", {
    p_message_id: messageId,
    p_conversation_id: id,
    p_sender_id: staff.id,
    p_sender_role: "agent",
    p_message: text,
    p_allow_override: staff.role === "admin",
  })
  if (error) return supportError(error)

  const { data: conversation } = await client.from("support_conversations").select("user_id").eq("id", id).single()
  await broadcast([
    { topic: STAFF_TOPIC, event: "message", payload: { conversationId: id } },
    ...(conversation ? [{ topic: userTopic(conversation.user_id), event: "message", payload: { conversationId: id } }] : []),
  ])

  return Response.json({ message: data })
}
