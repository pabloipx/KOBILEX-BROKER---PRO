import { MAX_MESSAGE_LENGTH, STAFF_TOPIC, userTopic } from "@/lib/support/constants"
import { UUID_RE, broadcast, db, getCustomer, jsonError, readJson, supportError } from "@/lib/support/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  const { id } = await params
  const body = await readJson(request)
  const messageId = typeof body?.id === "string" ? body.id : ""
  const text = typeof body?.message === "string" ? body.message.trim() : ""

  if (!UUID_RE.test(id) || !UUID_RE.test(messageId)) return jsonError("Requisição inválida.", 400)
  if (!text) return jsonError("A mensagem não pode ficar vazia.", 400)
  if (text.length > MAX_MESSAGE_LENGTH) return jsonError(`Limite de ${MAX_MESSAGE_LENGTH} caracteres.`, 400)

  const { data, error } = await db().rpc("support_post_message", {
    p_message_id: messageId,
    p_conversation_id: id,
    p_sender_id: user.id,
    p_sender_role: "customer",
    p_message: text,
    p_allow_override: false,
  })
  if (error) return supportError(error)

  await broadcast([
    { topic: STAFF_TOPIC, event: "message", payload: { conversationId: id } },
    { topic: userTopic(user.id), event: "message", payload: { conversationId: id } },
  ])

  return Response.json({ message: data })
}
