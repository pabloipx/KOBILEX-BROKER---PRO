import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { getSecret, isAdminRequest } from "@/lib/admin/session"
import { db } from "./server"

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export const AGENT_COOKIE = "support_agent_session"
const AGENT_TTL_SECONDS = 60 * 60 * 12

export type Staff = {
  id: string
  name: string
  email: string
  role: "admin" | "agent"
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false
  const [scheme, saltB64, hashB64] = stored.split("$")
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, "base64")
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`support-agent:${getSecret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))
  return Buffer.from(sig).toString("base64url")
}

export async function createAgentSessionValue(agentId: string): Promise<string> {
  const payload = `${agentId}|${Date.now() + AGENT_TTL_SECONDS * 1000}`
  return `${payload}|${await hmac(payload)}`
}

async function verifyAgentSessionValue(value: string | undefined): Promise<string | null> {
  if (!value || !getSecret()) return null
  const parts = value.split("|")
  if (parts.length !== 3) return null
  const [agentId, expiresAt, signature] = parts
  const expected = await hmac(`${agentId}|${expiresAt}`)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!Number.isFinite(Number(expiresAt)) || Date.now() > Number(expiresAt)) return null
  return agentId
}

export function agentCookieOptions(maxAge: number = AGENT_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

let cachedAdmin: Staff | null = null

/** O administrador do painel (ADMIN_EMAIL) também é registrado em support_agents para autoria das mensagens. */
async function ensureAdminStaff(): Promise<Staff | null> {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
  if (!email) return null
  if (cachedAdmin?.email === email) return cachedAdmin

  const client = db()
  const { data: existing } = await client
    .from("support_agents")
    .select("id, name, email, role")
    .eq("email", email)
    .maybeSingle()

  let row = existing
  if (!row) {
    const { data: inserted, error } = await client
      .from("support_agents")
      .insert({ email, name: "Administrador", role: "admin" })
      .select("id, name, email, role")
      .single()
    if (error) {
      const { data: retry } = await client
        .from("support_agents")
        .select("id, name, email, role")
        .eq("email", email)
        .maybeSingle()
      row = retry
    } else {
      row = inserted
    }
  }
  if (!row) return null
  cachedAdmin = { id: row.id, name: row.name, email: row.email, role: "admin" }
  return cachedAdmin
}

/** Identifica quem está usando o painel de suporte. Toda rota da equipe chama isto antes de acessar o banco. */
export async function getStaff(): Promise<Staff | null> {
  try {
    if (await isAdminRequest()) return await ensureAdminStaff()

    const store = await cookies()
    const agentId = await verifyAgentSessionValue(store.get(AGENT_COOKIE)?.value)
    if (!agentId) return null

    const { data } = await db()
      .from("support_agents")
      .select("id, name, email, role, active")
      .eq("id", agentId)
      .maybeSingle()
    if (!data || !data.active) return null
    return { id: data.id, name: data.name, email: data.email, role: data.role === "admin" ? "admin" : "agent" }
  } catch (error) {
    console.error("[support] falha ao validar equipe:", (error as Error).message)
    return null
  }
}

export function staffUnauthorized() {
  return Response.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 })
}
