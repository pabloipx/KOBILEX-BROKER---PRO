import { CATEGORY_KEYS, CONFIRMATION_MESSAGE, STAFF_TOPIC, WELCOME_MESSAGE, getCategory, userTopic } from "@/lib/support/constants"
import { broadcast, getCustomer, jsonError, queryOne, readJson, supportError } from "@/lib/support/server"

export const dynamic = "force-dynamic"

type ConversationRow = { id: string; status: string; category: string | null }

/** Inicia (ou retorna) o atendimento ativo do cliente. Opcionalmente já registra o assunto. */
export async function POST(request: Request) {
  const user = await getCustomer()
  if (!user) return jsonError("Faça login para falar com o suporte.", 401)

  const body = (await readJson(request)) ?? {}
  const categoryKey = typeof body.category === "string" ? body.category : null
  if (categoryKey && !(CATEGORY_KEYS as string[]).includes(categoryKey)) return jsonError("Assunto inválido.", 400)

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const name = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null
  const username = typeof meta.username === "string" ? meta.username : null

  let result: ConversationRow | null
  try {
    result = await queryOne<ConversationRow>(
      "select id, status, category from support_start_conversation($1, $2, $3, $4, $5)",
      [user.id, WELCOME_MESSAGE, name, username, user.email ?? null],
    )
    if (!result) return supportError(null)

    if (categoryKey && !result.category) {
      const category = getCategory(categoryKey)!
      result = await queryOne<ConversationRow>(
        "select id, status, category from support_set_category($1, $2, $3, $4, $5)",
        [result.id, user.id, category.key, `${category.emoji} ${category.label}`, CONFIRMATION_MESSAGE],
      )
      if (!result) return supportError(null)
    }
  } catch (error) {
    return supportError(error as Error)
  }

  await broadcast([
    { topic: STAFF_TOPIC, event: "conversation", payload: { conversationId: result.id } },
    { topic: userTopic(user.id), event: "conversation", payload: { conversationId: result.id } },
  ])

  return Response.json({ conversation: { id: result.id, status: result.status, category: result.category } })
}
