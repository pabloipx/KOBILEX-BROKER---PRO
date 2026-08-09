// Sessao administrativa baseada em cookie HttpOnly assinado (HMAC-SHA256).
//
// Antes deste modulo a autorizacao do painel era feita comparando um header
// "x-admin-token" com uma senha fixa escrita no proprio codigo. Como essa
// string tambem existia nos componentes de cliente, ela era enviada no bundle
// para o navegador de qualquer visitante. Somada ao fato de as rotas admin usarem
// a service role key (que ignora o RLS), qualquer pessoa que abrisse o DevTools
// tinha acesso total ao banco. Agora o segredo nunca sai do servidor.

import { cookies } from "next/headers"

export const ADMIN_COOKIE = "admin_session"

const SESSION_TTL_SECONDS = 60 * 60 * 8 // 8 horas

function getSecret(): string {
  // Nenhuma variavel nova e obrigatoria: a chave de assinatura e derivada de
  // segredos que ja existem no servidor. Trocar a senha do admin invalida
  // automaticamente as sessoes emitidas antes da troca.
  const material = [
    process.env.ADMIN_SESSION_SECRET || "",
    process.env.SUPABASE_JWT_SECRET || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    process.env.ADMIN_PASSWORD || "",
  ]
    .filter(Boolean)
    .join(":")

  return material
}

export function isAdminAuthConfigured(): boolean {
  return !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && getSecret())
}

function base64url(bytes: Uint8Array): string {
  let out = ""
  for (const b of bytes) out += String.fromCharCode(b)
  return btoa(out).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return base64url(new Uint8Array(sig))
}

// Comparacao em tempo constante para nao vazar informacao pelo tempo de resposta.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// O separador nao pode ser "." porque o e-mail do admin contem pontos, o que
// quebraria a divisao do payload na verificacao.
const SEP = "|"

export async function createAdminSessionValue(email: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000
  const payload = `${email}${SEP}${expiresAt}`
  const signature = await sign(payload)
  return `${payload}${SEP}${signature}`
}

export async function verifyAdminSessionValue(value: string | undefined): Promise<boolean> {
  if (!value || !isAdminAuthConfigured()) return false

  const parts = value.split(SEP)
  if (parts.length !== 3) return false

  const [email, expiresAt, signature] = parts
  const payload = `${email}${SEP}${expiresAt}`

  const expected = await sign(payload)
  if (!safeEqual(signature, expected)) return false

  const expiry = Number(expiresAt)
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false

  return email === (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
}

/**
 * Valida a sessao admin da requisicao atual. Toda rota em /api/admin deve
 * chamar esta funcao antes de tocar no banco com a service role key.
 */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies()
  return verifyAdminSessionValue(store.get(ADMIN_COOKIE)?.value)
}

export function adminCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function unauthorizedResponse() {
  return Response.json({ error: "Nao autorizado", success: false }, { status: 401 })
}
