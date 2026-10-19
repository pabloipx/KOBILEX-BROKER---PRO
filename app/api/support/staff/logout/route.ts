import { cookies } from "next/headers"
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/admin/session"
import { AGENT_COOKIE, agentCookieOptions } from "@/lib/support/staff"

export async function POST() {
  const store = await cookies()
  store.set(ADMIN_COOKIE, "", adminCookieOptions(0))
  store.set(AGENT_COOKIE, "", agentCookieOptions(0))
  return Response.json({ success: true })
}
