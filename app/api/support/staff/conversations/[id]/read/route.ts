import { STAFF_TOPIC } from "@/lib/support/constants"
import { UUID_RE, broadcast, db, jsonError } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  const { data: updated } = await db()
    .from("support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .eq("sender_role", "customer")
    .is("read_at", null)
    .select("id")

  if (updated?.length) await broadcast([{ topic: STAFF_TOPIC, event: "read", payload: { conversationId: id } }])
  return Response.json({ ok: true })
}
