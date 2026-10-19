import { getCustomer, queryOne } from "@/lib/support/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCustomer()
  if (!user) return Response.json({ userId: null, count: 0 })

  try {
    const row = await queryOne<{ count: number }>(
      `select count(m.id)::int as count
       from (select id from support_conversations where user_id = $1 order by created_at desc limit 1) c
       join support_messages m on m.conversation_id = c.id
       where m.sender_role <> 'customer' and m.read_at is null`,
      [user.id],
    )
    return Response.json({ userId: user.id, count: row?.count ?? 0 })
  } catch (error) {
    console.error("[support] falha ao contar não lidas:", (error as Error).message)
    return Response.json({ userId: user.id, count: 0 })
  }
}
