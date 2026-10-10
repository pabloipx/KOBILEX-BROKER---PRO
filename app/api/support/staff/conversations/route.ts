import { CATEGORY_KEYS, STATUS_KEYS } from "@/lib/support/constants"
import { jsonError, query, queryOne } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type StatsRow = {
  total: number
  new: number
  waiting_agent: number
  in_progress: number
  waiting_customer: number
  completed: number
  unread: number
}

export async function GET(request: Request) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const params = new URL(request.url).searchParams
  const view = params.get("view") === "completed" ? "completed" : "active"
  const status = params.get("status") ?? ""
  const category = params.get("category") ?? ""
  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""
  const q = (params.get("q") ?? "").trim().slice(0, 80)

  const where: string[] = []
  const values: unknown[] = []
  const add = (clause: (p: string) => string, value: unknown) => {
    values.push(value)
    where.push(clause(`$${values.length}`))
  }

  let order: string
  if (view === "completed") {
    where.push("status = 'completed'")
    order = "closed_at desc nulls last"
    if (DATE_RE.test(from)) add((p) => `closed_at >= ${p}::timestamptz`, `${from}T00:00:00-03:00`)
    if (DATE_RE.test(to)) add((p) => `closed_at <= ${p}::timestamptz`, `${to}T23:59:59.999-03:00`)
  } else {
    where.push("status <> 'completed'")
    order = "last_message_at desc"
    if ((STATUS_KEYS as string[]).includes(status) && status !== "completed") add((p) => `status = ${p}`, status)
  }
  if ((CATEGORY_KEYS as string[]).includes(category)) add((p) => `category = ${p}`, category)
  if (q) {
    const term = q.replace(/^#/, "").replace(/[\\%_]/g, (c) => `\\${c}`)
    values.push(`%${term}%`)
    const like = `$${values.length}`
    const clauses = [
      `customer_name ilike ${like}`,
      `customer_username ilike ${like}`,
      `customer_email ilike ${like}`,
      `account_id ilike ${like}`,
      `id_text ilike ${like}`,
    ]
    if (/^\d+$/.test(term)) {
      values.push(term)
      clauses.push(`number_text = $${values.length}`)
    }
    where.push(`(${clauses.join(" or ")})`)
  }

  try {
    const [items, stats] = await Promise.all([
      query(
        `select id, number::int as number, user_id, account_id, category, status, assigned_agent_id, assigned_agent_name,
                last_message_preview, last_message_at, created_at, closed_at, closed_by_name,
                customer_name, customer_username, unread_count
         from support_conversation_list
         where ${where.join(" and ")}
         order by ${order}
         limit 100`,
        values,
      ),
      queryOne<StatsRow>(
        `select
           count(*)::int as total,
           count(*) filter (where status = 'new')::int as new,
           count(*) filter (where status = 'waiting_agent')::int as waiting_agent,
           count(*) filter (where status = 'in_progress')::int as in_progress,
           count(*) filter (where status = 'waiting_customer')::int as waiting_customer,
           count(*) filter (where status = 'completed')::int as completed,
           (select count(*)::int from support_messages where sender_role = 'customer' and read_at is null) as unread
         from support_conversations`,
      ),
    ])

    return Response.json({
      staff,
      items,
      stats: stats ?? { total: 0, new: 0, waiting_agent: 0, in_progress: 0, waiting_customer: 0, completed: 0, unread: 0 },
    })
  } catch (error) {
    console.error("[support] falha ao listar atendimentos:", (error as Error).message)
    return jsonError("Não foi possível carregar os atendimentos.", 503)
  }
}
