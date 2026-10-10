import { db, jsonError, readJson } from "@/lib/support/server"
import { getStaff, hashPassword, staffUnauthorized } from "@/lib/support/staff"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { data, error } = await db()
    .from("support_agents")
    .select("id, name, email, role, active, created_at")
    .order("created_at", { ascending: true })
  if (error) return jsonError("Não foi possível carregar a equipe.", 503)

  return Response.json({
    agents: (data ?? []).map((a) => (staff.role === "admin" ? a : { id: a.id, name: a.name, role: a.role, active: a.active })),
  })
}

export async function POST(request: Request) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()
  if (staff.role !== "admin") return jsonError("Apenas administradores podem gerenciar a equipe.", 403)

  const body = await readJson(request)
  const name = String(body?.name ?? "").trim().slice(0, 80)
  const email = String(body?.email ?? "").trim().toLowerCase()
  const password = String(body?.password ?? "")
  const role = body?.role === "admin" ? "admin" : "agent"

  if (!name) return jsonError("Informe o nome.", 400)
  if (!EMAIL_RE.test(email)) return jsonError("Email inválido.", 400)
  if (password.length < 8) return jsonError("A senha precisa ter pelo menos 8 caracteres.", 400)

  const { error } = await db()
    .from("support_agents")
    .insert({ name, email, role, password_hash: await hashPassword(password) })
  if (error) {
    if (error.code === "23505") return jsonError("Já existe um membro com este email.", 409)
    return jsonError("Não foi possível criar o atendente.", 503)
  }
  return Response.json({ ok: true })
}
