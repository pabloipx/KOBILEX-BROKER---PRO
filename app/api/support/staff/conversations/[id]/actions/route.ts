import { CLOSED_MESSAGE, REOPENED_MESSAGE, STAFF_TOPIC, userTopic } from "@/lib/support/constants"
import { UUID_RE, broadcast, jsonError, query, queryOne, readJson, supportError } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

const MANUAL_STATUSES = ["waiting_agent", "in_progress", "waiting_customer"]

type CurrentRow = { id: string; user_id: string; status: string; assigned_agent_id: string | null }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  const body = await readJson(request)
  const action = body?.action
  const isAdmin = staff.role === "admin"

  try {
    const current = await queryOne<CurrentRow>(
      "select id, user_id, status, assigned_agent_id from support_conversations where id = $1",
      [id],
    )
    if (!current) return jsonError("Atendimento não encontrado.", 404)

    const canManage = isAdmin || !current.assigned_agent_id || current.assigned_agent_id === staff.id

    if (action === "close") {
      await query("select id from support_close_conversation($1, $2, $3, $4)", [id, staff.id, isAdmin, CLOSED_MESSAGE])
    } else if (action === "reopen") {
      if (!canManage) return jsonError("Apenas o atendente responsável ou um administrador pode reabrir.", 403)
      await query("select id from support_reopen_conversation($1, $2, $3)", [id, staff.id, REOPENED_MESSAGE])
    } else if (action === "status") {
      const status = String(body?.status ?? "")
      if (!MANUAL_STATUSES.includes(status)) return jsonError("Status inválido.", 400)
      if (!canManage) return jsonError("Este atendimento está com outro atendente.", 403)
      const updated = await query(
        `update support_conversations set status = $2, updated_at = now()
         where id = $1 and status <> 'completed' returning id`,
        [id, status],
      )
      if (!updated.length) return jsonError("Atendimentos concluídos não podem mudar de status.", 409)
      await query(
        `insert into support_audit_log (conversation_id, actor_id, actor_role, action, details)
         values ($1, $2, $3, 'status_changed', $4::jsonb)`,
        [id, staff.id, staff.role, JSON.stringify({ from: current.status, to: status })],
      )
    } else if (action === "assign") {
      const agentId = body?.agentId === null ? null : String(body?.agentId ?? "")
      if (agentId !== null && !UUID_RE.test(agentId)) return jsonError("Atendente inválido.", 400)
      if (!isAdmin && agentId !== staff.id) return jsonError("Apenas administradores podem transferir atendimentos.", 403)
      if (!isAdmin && current.assigned_agent_id && current.assigned_agent_id !== staff.id) {
        return jsonError("Este atendimento está com outro atendente.", 403)
      }
      if (agentId) {
        const agent = await queryOne<{ active: boolean }>("select active from support_agents where id = $1", [agentId])
        if (!agent?.active) return jsonError("Atendente indisponível.", 400)
      }
      await query("update support_conversations set assigned_agent_id = $2, updated_at = now() where id = $1", [
        id,
        agentId,
      ])
      await query(
        `insert into support_audit_log (conversation_id, actor_id, actor_role, action, details)
         values ($1, $2, $3, 'assigned', $4::jsonb)`,
        [id, staff.id, staff.role, JSON.stringify({ from: current.assigned_agent_id, to: agentId })],
      )
    } else {
      return jsonError("Ação inválida.", 400)
    }

    await broadcast([
      { topic: STAFF_TOPIC, event: "conversation", payload: { conversationId: id } },
      { topic: userTopic(current.user_id), event: "conversation", payload: { conversationId: id } },
    ])
    return Response.json({ ok: true })
  } catch (error) {
    return supportError(error as Error)
  }
}
