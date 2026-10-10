import { MAX_MESSAGE_LENGTH, STAFF_TOPIC } from "@/lib/support/constants"
import { UUID_RE, broadcast, jsonError, query, readJson } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  const body = await readJson(request)
  const note = typeof body?.note === "string" ? body.note.trim() : ""
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)
  if (!note || note.length > MAX_MESSAGE_LENGTH) return jsonError("Nota inválida.", 400)

  try {
    await query("insert into support_internal_notes (conversation_id, admin_id, note) values ($1, $2, $3)", [
      id,
      staff.id,
      note,
    ])
    await query(
      "insert into support_audit_log (conversation_id, actor_id, actor_role, action) values ($1, $2, $3, 'note_added')",
      [id, staff.id, staff.role],
    )
  } catch (error) {
    console.error("[support] falha ao salvar nota:", (error as Error).message)
    return jsonError("Não foi possível salvar a nota.", 503)
  }

  await broadcast([{ topic: STAFF_TOPIC, event: "note", payload: { conversationId: id } }])
  return Response.json({ ok: true })
}
