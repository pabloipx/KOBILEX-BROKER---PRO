import { MAX_MESSAGE_LENGTH, STAFF_TOPIC, userTopic } from "@/lib/support/constants"
import { UUID_RE, broadcast, jsonError, queryOne, readJson, supportError } from "@/lib/support/server"
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

  let data
  let conversation: { user_id: string } | null
  try {
    data = await queryOne("select * from support_post_message($1, $2, $3, 'agent', $4, $5)", [
      messageId,
      id,
      staff.id,
      text,
      staff.role === "admin",
    ])
    conversation = await queryOne<{ user_id: string }>("select user_id from support_conversations where id = $1", [id])
  } catch (error) {
    return supportError(error as Error)
  }

  await broadcast([
    { topic: STAFF_TOPIC, event: "message", payload: { conversationId: id } },
    ...(conversation ? [{ topic: userTopic(conversation.user_id), event: "message", payload: { conversationId: id } }] : []),
  ])

  return Response.json({ message: data })
}
