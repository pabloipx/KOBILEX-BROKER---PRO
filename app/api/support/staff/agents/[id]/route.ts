import { UUID_RE, jsonError, query, readJson } from "@/lib/support/server"
import { getStaff, hashPassword, staffUnauthorized } from "@/lib/support/staff"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()
  if (staff.role !== "admin") return jsonError("Apenas administradores podem gerenciar a equipe.", 403)

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendente inválido.", 400)
  if (id === staff.id) return jsonError("Você não pode alterar a própria conta por aqui.", 400)

  const body = await readJson(request)
  const active = typeof body?.active === "boolean" ? body.active : null
  const role = body?.role === "admin" || body?.role === "agent" ? body.role : null
  let passwordHash: string | null = null
  if (typeof body?.password === "string" && body.password) {
    if (body.password.length < 8) return jsonError("A senha precisa ter pelo menos 8 caracteres.", 400)
    passwordHash = await hashPassword(body.password)
  }

  try {
    await query(
      `update support_agents
       set active = coalesce($2, active),
           role = coalesce($3, role),
           password_hash = coalesce($4, password_hash),
           updated_at = now()
       where id = $1`,
      [id, active, role, passwordHash],
    )
  } catch (error) {
    console.error("[support] falha ao atualizar atendente:", (error as Error).message)
    return jsonError("Não foi possível atualizar o atendente.", 503)
  }
  return Response.json({ ok: true })
}
