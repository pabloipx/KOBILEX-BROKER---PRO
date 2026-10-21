import {
  IMAGE_ONLY_MESSAGE,
  MAX_MESSAGE_LENGTH,
  STAFF_TOPIC,
  SUPPORT_IMAGE_BUCKET,
  userTopic,
} from "@/lib/support/constants"
import { UUID_RE, broadcast, jsonError, query, queryOne, readJson, supportError } from "@/lib/support/server"
import { getSupabaseUrl } from "@/lib/supabase/env"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  const body = await readJson(request)
  const messageId = typeof body?.id === "string" ? body.id : ""
  const caption = typeof body?.message === "string" ? body.message.trim() : ""
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : ""
  const imagePrefix = `${getSupabaseUrl()}/storage/v1/object/public/${SUPPORT_IMAGE_BUCKET}/`

  if (!UUID_RE.test(id) || !UUID_RE.test(messageId)) return jsonError("Requisição inválida.", 400)
  if (imageUrl && staff.role !== "admin") return jsonError("Apenas o administrador pode enviar fotos.", 403)
  if (imageUrl && (!getSupabaseUrl() || !imageUrl.startsWith(imagePrefix))) return jsonError("Imagem inválida.", 400)
  if (!caption && !imageUrl) return jsonError("A mensagem não pode ficar vazia.", 400)
  if (caption.length > MAX_MESSAGE_LENGTH) return jsonError(`Limite de ${MAX_MESSAGE_LENGTH} caracteres.`, 400)
  const text = caption || IMAGE_ONLY_MESSAGE

  let data
  let conversation: { user_id: string } | null
  try {
    data = await queryOne<Record<string, unknown>>("select * from support_post_message($1, $2, $3, 'agent', $4, $5)", [
      messageId,
      id,
      staff.id,
      text,
      staff.role === "admin",
    ])
    if (imageUrl && data) {
      await query("update support_messages set image_url = $1 where id = $2 and sender_role = 'agent'", [
        imageUrl,
        messageId,
      ])
      data = { ...data, image_url: imageUrl }
    }
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
