import { CATEGORY_KEYS, STATUS_KEYS } from "@/lib/support/constants"
import { db, jsonError } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()

  const params = new URL(request.url).searchParams
  const view = params.get("view") === "completed" ? "completed" : "active"
  const status = params.get("status") ?? ""
  const category = params.get("category") ?? ""
  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""
  // Remove caracteres com significado na sintaxe de filtros do PostgREST.
  const q = (params.get("q") ?? "").replace(/[,()*%:\\"'.]/g, " ").trim().slice(0, 80)

  const client = db()
  let query = client
    .from("support_conversation_list")
    .select(
      "id, number, user_id, account_id, category, status, assigned_agent_id, assigned_agent_name, last_message_preview, last_message_at, created_at, closed_at, closed_by_name, customer_name, customer_username, unread_count",
    )
    .limit(100)

  if (view === "completed") {
    query = query.eq("status", "completed").order("closed_at", { ascending: false })
    if (DATE_RE.test(from)) query = query.gte("closed_at", `${from}T00:00:00-03:00`)
    if (DATE_RE.test(to)) query = query.lte("closed_at", `${to}T23:59:59.999-03:00`)
  } else {
    query = query.neq("status", "completed").order("last_message_at", { ascending: false })
    if ((STATUS_KEYS as string[]).includes(status) && status !== "completed") query = query.eq("status", status)
  }
  if ((CATEGORY_KEYS as string[]).includes(category)) query = query.eq("category", category)
  if (q) {
    const term = q.replace(/^#/, "").replace(/\s+/g, " ")
    const filters = [
      `customer_name.ilike.*${term}*`,
      `customer_username.ilike.*${term}*`,
      `customer_email.ilike.*${term}*`,
      `account_id.ilike.*${term}*`,
      `id_text.ilike.*${term}*`,
    ]
    if (/^\d+$/.test(term)) filters.push(`number_text.eq.${term}`)
    query = query.or(filters.join(","))
  }

  const count = (build: (q: ReturnType<typeof client.from>) => unknown) =>
    build(client.from("support_conversations")) as PromiseLike<{ count: number | null }>
  const head = { count: "exact" as const, head: true }

  const [list, total, fresh, waiting, progress, waitingCustomer, completed, unread] = await Promise.all([
    query,
    count((t) => t.select("id", head)),
    count((t) => t.select("id", head).eq("status", "new")),
    count((t) => t.select("id", head).eq("status", "waiting_agent")),
    count((t) => t.select("id", head).eq("status", "in_progress")),
    count((t) => t.select("id", head).eq("status", "waiting_customer")),
    count((t) => t.select("id", head).eq("status", "completed")),
    client
      .from("support_messages")
      .select("id", head)
      .eq("sender_role", "customer")
      .is("read_at", null) as unknown as PromiseLike<{ count: number | null }>,
  ])

  if (list.error) return jsonError("Não foi possível carregar os atendimentos.", 503)

  return Response.json({
    staff,
    items: list.data ?? [],
    stats: {
      total: total.count ?? 0,
      new: fresh.count ?? 0,
      waiting_agent: waiting.count ?? 0,
      in_progress: progress.count ?? 0,
      waiting_customer: waitingCustomer.count ?? 0,
      completed: completed.count ?? 0,
      unread: unread.count ?? 0,
    },
  })
}
