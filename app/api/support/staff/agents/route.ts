import { isUniqueViolation, jsonError, query, readJson } from "@/lib/support/server"
import { getStaff, hashPassword, staffUnauthorized } from "@/lib/support/staff"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AgentRow = { id: string; name: string; email: string; role: string; active: boolean; created_at: string }

export async function GET() {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  try {
    const agents = await query<AgentRow>(
      "select id, name, email, role, active, created_at from support_agents order by created_at asc",
    )
    return Response.json({
      agents: agents.map((a) => (staff.role === "admin" ? a : { id: a.id, name: a.name, role: a.role, active: a.active })),
    })
  } catch (error) {
    console.error("[support] falha ao carregar equipe:", (error as Error).message)
    return jsonError("Não foi possível carregar a equipe.", 503)
  }
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

  try {
    await query("insert into support_agents (name, email, role, password_hash) values ($1, $2, $3, $4)", [
      name,
      email,
      role,
      await hashPassword(password),
    ])
  } catch (error) {
    if (isUniqueViolation(error)) return jsonError("Já existe um membro com este email.", 409)
    console.error("[support] falha ao criar atendente:", (error as Error).message)
    return jsonError("Não foi possível criar o atendente.", 503)
  }
  return Response.json({ ok: true })
}
