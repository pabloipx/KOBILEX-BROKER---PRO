import { cookies } from "next/headers"
import { ADMIN_COOKIE, adminCookieOptions, createAdminSessionValue, isAdminAuthConfigured } from "@/lib/admin/session"
import { AGENT_COOKIE, agentCookieOptions, createAgentSessionValue, verifyPassword } from "@/lib/support/staff"
import { db, readJson } from "@/lib/support/server"

export const runtime = "nodejs"

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(request: Request) {
  const body = await readJson(request)
  const email = String(body?.email ?? "").trim().toLowerCase()
  const password = String(body?.password ?? "")
  if (!email || !password) return Response.json({ error: "Informe email e senha." }, { status: 400 })

  const store = await cookies()
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()

  if (isAdminAuthConfigured() && email === adminEmail && password === (process.env.ADMIN_PASSWORD || "")) {
    store.set(ADMIN_COOKIE, await createAdminSessionValue(adminEmail), adminCookieOptions())
    return Response.json({ success: true, role: "admin" })
  }

  const { data: agent } = await db()
    .from("support_agents")
    .select("id, password_hash, active")
    .eq("email", email)
    .maybeSingle()

  if (agent?.active && (await verifyPassword(password, agent.password_hash))) {
    store.set(AGENT_COOKIE, await createAgentSessionValue(agent.id), agentCookieOptions())
    return Response.json({ success: true, role: "agent" })
  }

  await delay(600)
  return Response.json({ error: "Email ou senha incorretos." }, { status: 401 })
}
