import { STAFF_TOPIC } from "@/lib/support/constants"
import { UUID_RE, broadcast, jsonError, query, supportError } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  try {
    const updated = await query(
      `update support_messages set read_at = now()
       where conversation_id = $1 and sender_role = 'customer' and read_at is null
       returning id`,
      [id],
    )
    if (updated.length) await broadcast([{ topic: STAFF_TOPIC, event: "read", payload: { conversationId: id } }])
    return Response.json({ ok: true })
  } catch (error) {
    return supportError(error as Error)
  }
}
