import { UUID_RE, jsonError, query, queryOne, supabaseAdmin } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export const dynamic = "force-dynamic"

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role: string
  kind: string
  message: string
  created_at: string
  read_at: string | null
  sender_name: string | null
}

/** O perfil do cliente continua no Supabase; falhas aqui não impedem o atendimento. */
async function loadProfile(userId: string) {
  try {
    const { data } = await supabaseAdmin()
      .from("profiles")
      .select("phone, country, kyc_status, is_verified, is_blocked, created_at")
      .eq("id", userId)
      .maybeSingle()
    return data ?? null
  } catch {
    return null
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const { id } = await params
  if (!UUID_RE.test(id)) return jsonError("Atendimento inválido.", 400)

  try {
    const conversation = await queryOne<Record<string, unknown> & { user_id: string; number: string }>(
      "select * from support_conversation_list where id = $1",
      [id],
    )
    if (!conversation) return jsonError("Atendimento não encontrado.", 404)

    const [messages, notes, profile, history] = await Promise.all([
      query<MessageRow>(
        `select m.id, m.conversation_id, m.sender_id, m.sender_role, m.kind, m.message, m.created_at, m.read_at,
                case when m.sender_role = 'agent' then coalesce(a.name, 'Atendente') end as sender_name
         from support_messages m
         left join support_agents a on a.id = m.sender_id and m.sender_role = 'agent'
         where m.conversation_id = $1
         order by m.created_at asc
         limit 1000`,
        [id],
      ),
      query<{ id: string; note: string; created_at: string; author: string }>(
        `select n.id, n.note, n.created_at, coalesce(a.name, 'Equipe') as author
         from support_internal_notes n
         left join support_agents a on a.id = n.admin_id
         where n.conversation_id = $1
         order by n.created_at asc`,
        [id],
      ),
      loadProfile(conversation.user_id),
      queryOne<{ count: number }>("select count(*)::int as count from support_conversations where user_id = $1", [
        conversation.user_id,
      ]),
    ])

    return Response.json({
      conversation: {
        ...conversation,
        number: Number(conversation.number),
        customer_total_conversations: history?.count ?? 1,
      },
      profile,
      messages,
      notes,
    })
  } catch (error) {
    console.error("[support] falha ao carregar atendimento:", (error as Error).message)
    return jsonError("Não foi possível carregar o atendimento.", 503)
  }
}
