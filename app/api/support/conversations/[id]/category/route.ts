import { CATEGORY_KEYS, CONFIRMATION_MESSAGE, STAFF_TOPIC, getCategory, userTopic } from "@/lib/support/constants"
import { UUID_RE, broadcast, db, getCustomer, jsonError, readJson, supportError } from "@/lib/support/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  const body = await readJson(request)
  const key = typeof body?.category === "string" ? body.category : ""
  if (!(CATEGORY_KEYS as string[]).includes(key)) return jsonError("Assunto inválido.", 400)
  const category = getCategory(key)!

  const { data, error } = await db().rpc("support_set_category", {
    p_conversation_id: id,
    p_user_id: user.id,
    p_category: category.key,
    p_label: `${category.emoji} ${category.label}`,
    p_confirmation: CONFIRMATION_MESSAGE,
  })
  if (error) return supportError(error)

  await broadcast([
    { topic: STAFF_TOPIC, event: "message", payload: { conversationId: id } },
    { topic: userTopic(user.id), event: "message", payload: { conversationId: id } },
  ])

  return Response.json({ conversation: { id: data.id, status: data.status, category: data.category } })
}
