import { CATEGORY_KEYS, CONFIRMATION_MESSAGE, STAFF_TOPIC, getCategory, userTopic } from "@/lib/support/constants"
import { UUID_RE, broadcast, getCustomer, jsonError, queryOne, readJson, supportError } from "@/lib/support/server"

type ConversationRow = { id: string; status: string; category: string | null }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  const body = await readJson(request)
  const key = typeof body?.category === "string" ? body.category : ""
  if (!(CATEGORY_KEYS as string[]).includes(key)) return jsonError("Assunto inválido.", 400)
  const category = getCategory(key)!

  let data: ConversationRow | null
  try {
    data = await queryOne<ConversationRow>(
      "select id, status, category from support_set_category($1, $2, $3, $4, $5)",
      [id, user.id, category.key, `${category.emoji} ${category.label}`, CONFIRMATION_MESSAGE],
    )
  } catch (error) {
    return supportError(error as Error)
  }
  if (!data) return supportError(null)

  await broadcast([
    { topic: STAFF_TOPIC, event: "message", payload: { conversationId: id } },
    { topic: userTopic(user.id), event: "message", payload: { conversationId: id } },
  ])

  return Response.json({ conversation: { id: data.id, status: data.status, category: data.category } })
}
