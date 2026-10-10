import { db, getCustomer } from "@/lib/support/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCustomer()
  if (!user) return Response.json({ userId: null, count: 0 })

  const client = db()
  const { data: active } = await client
    .from("support_conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!active) return Response.json({ userId: user.id, count: 0 })

  const { count } = await client
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", active.id)
    .neq("sender_role", "customer")
    .is("read_at", null)

  return Response.json({ userId: user.id, count: count ?? 0 })
}
