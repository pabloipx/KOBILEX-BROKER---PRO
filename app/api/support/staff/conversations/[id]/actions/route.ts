import { CLOSED_MESSAGE, REOPENED_MESSAGE, STAFF_TOPIC, userTopic } from "@/lib/support/constants"
import { UUID_RE, broadcast, db, jsonError, readJson, supportError } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

const MANUAL_STATUSES = ["waiting_agent", "in_progress", "waiting_customer"]

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  const body = await readJson(request)
  const action = body?.action
  const client = db()
  const isAdmin = staff.role === "admin"

  const { data: current } = await client
    .from("support_conversations")
    .select("id, user_id, status, assigned_agent_id")
    .eq("id", id)
    .maybeSingle()
  if (!current) return jsonError("Atendimento não encontrado.", 404)

  const canManage = isAdmin || !current.assigned_agent_id || current.assigned_agent_id === staff.id

  if (action === "close") {
    const { error } = await client.rpc("support_close_conversation", {
      p_conversation_id: id,
      p_agent_id: staff.id,
      p_allow_override: isAdmin,
      p_closed_message: CLOSED_MESSAGE,
    })
    if (error) return supportError(error)
  } else if (action === "reopen") {
    if (!canManage) return jsonError("Apenas o atendente responsável ou um administrador pode reabrir.", 403)
    const { error } = await client.rpc("support_reopen_conversation", {
      p_conversation_id: id,
      p_agent_id: staff.id,
      p_reopened_message: REOPENED_MESSAGE,
    })
    if (error) return supportError(error)
  } else if (action === "status") {
    const status = String(body?.status ?? "")
    if (!MANUAL_STATUSES.includes(status)) return jsonError("Status inválido.", 400)
    if (!canManage) return jsonError("Este atendimento está com outro atendente.", 403)
    const { data, error } = await client
      .from("support_conversations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .neq("status", "completed")
      .select("id")
    if (error) return supportError(error)
    if (!data?.length) return jsonError("Atendimentos concluídos não podem mudar de status.", 409)
    await client.from("support_audit_log").insert({
      conversation_id: id,
      actor_id: staff.id,
      actor_role: staff.role,
      action: "status_changed",
      details: { from: current.status, to: status },
    })
  } else if (action === "assign") {
    const agentId = body?.agentId === null ? null : String(body?.agentId ?? "")
    if (agentId !== null && !UUID_RE.test(agentId)) return jsonError("Atendente inválido.", 400)
    if (!isAdmin && agentId !== staff.id) return jsonError("Apenas administradores podem transferir atendimentos.", 403)
    if (!isAdmin && current.assigned_agent_id && current.assigned_agent_id !== staff.id) {
      return jsonError("Este atendimento está com outro atendente.", 403)
    }
    if (agentId) {
      const { data: agent } = await client.from("support_agents").select("id, active").eq("id", agentId).maybeSingle()
      if (!agent?.active) return jsonError("Atendente indisponível.", 400)
    }
    const { error } = await client
      .from("support_conversations")
      .update({ assigned_agent_id: agentId, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return supportError(error)
    await client.from("support_audit_log").insert({
      conversation_id: id,
      actor_id: staff.id,
      actor_role: staff.role,
      action: "assigned",
      details: { from: current.assigned_agent_id, to: agentId },
    })
  } else {
    return jsonError("Ação inválida.", 400)
  }

  await broadcast([
    { topic: STAFF_TOPIC, event: "conversation", payload: { conversationId: id } },
    { topic: userTopic(current.user_id), event: "conversation", payload: { conversationId: id } },
  ])
  return Response.json({ ok: true })
}
