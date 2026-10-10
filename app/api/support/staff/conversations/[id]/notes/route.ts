import { MAX_MESSAGE_LENGTH, STAFF_TOPIC } from "@/lib/support/constants"
import { UUID_RE, broadcast, db, jsonError, readJson } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  const body = await readJson(request)
  const note = typeof body?.note === "string" ? body.note.trim() : ""
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)
  if (!note || note.length > MAX_MESSAGE_LENGTH) return jsonError("Nota inválida.", 400)

  const client = db()
  const { error } = await client.from("support_internal_notes").insert({ conversation_id: id, admin_id: staff.id, note })
  if (error) return jsonError("Não foi possível salvar a nota.", 503)

  await client
    .from("support_audit_log")
    .insert({ conversation_id: id, actor_id: staff.id, actor_role: staff.role, action: "note_added" })
  await broadcast([{ topic: STAFF_TOPIC, event: "note", payload: { conversationId: id } }])
  return Response.json({ ok: true })
}
