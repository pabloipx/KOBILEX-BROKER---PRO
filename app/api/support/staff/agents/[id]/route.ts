import { UUID_RE, db, jsonError, readJson } from "@/lib/support/server"
import { getStaff, hashPassword, staffUnauthorized } from "@/lib/support/staff"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()
  if (staff.role !== "admin") return jsonError("Apenas administradores podem gerenciar a equipe.", 403)

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendente inválido.", 400)
  if (id === staff.id) return jsonError("Você não pode alterar a própria conta por aqui.", 400)

  const body = await readJson(request)
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.active === "boolean") update.active = body.active
  if (body?.role === "admin" || body?.role === "agent") update.role = body.role
  if (typeof body?.password === "string" && body.password) {
    if (body.password.length < 8) return jsonError("A senha precisa ter pelo menos 8 caracteres.", 400)
    update.password_hash = await hashPassword(body.password)
  }

  const { error } = await db().from("support_agents").update(update).eq("id", id)
  if (error) return jsonError("Não foi possível atualizar o atendente.", 503)
  return Response.json({ ok: true })
}
