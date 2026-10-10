import { CATEGORY_KEYS, CONFIRMATION_MESSAGE, STAFF_TOPIC, WELCOME_MESSAGE, getCategory, userTopic } from "@/lib/support/constants"
import { broadcast, db, getCustomer, jsonError, readJson, supportError } from "@/lib/support/server"

export const dynamic = "force-dynamic"

/** Inicia (ou retorna) o atendimento ativo do cliente. Opcionalmente já registra o assunto. */
export async function POST(request: Request) {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  const body = (await readJson(request)) ?? {}
  const categoryKey = typeof body.category === "string" ? body.category : null
  if (categoryKey && !(CATEGORY_KEYS as string[]).includes(categoryKey)) return jsonError("Assunto inválido.", 400)

  const client = db()
  const { data: conversation, error } = await client.rpc("support_start_conversation", {
    p_user_id: user.id,
    p_welcome: WELCOME_MESSAGE,
  })
  if (error || !conversation) return supportError(error)

  let result = conversation
  if (categoryKey && !conversation.category) {
    const category = getCategory(categoryKey)!
    const { data, error: catError } = await client.rpc("support_set_category", {
      p_conversation_id: conversation.id,
      p_user_id: user.id,
      p_category: category.key,
      p_label: `${category.emoji} ${category.label}`,
      p_confirmation: CONFIRMATION_MESSAGE,
    })
    if (catError) return supportError(catError)
    result = data
  }

  await broadcast([
    { topic: STAFF_TOPIC, event: "conversation", payload: { conversationId: result.id } },
    { topic: userTopic(user.id), event: "conversation", payload: { conversationId: result.id } },
  ])

  return Response.json({ conversation: { id: result.id, status: result.status, category: result.category } })
}
