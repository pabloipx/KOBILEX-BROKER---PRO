import { type NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { isAdminRequest } from "@/lib/admin/session"

export const dynamic = "force-dynamic"

// Brasil (America/Sao_Paulo) sem horário de verão: UTC-3 fixo.
const TZ_OFFSET_MS = 3 * 3_600_000
const DAY_MS = 86_400_000
const MAX_DAYS = 366
const PAGE_SIZE = 1000
const MAX_ROWS = 50_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const APPROVED = new Set(["completed", "approved"])

const KINDS = ["deposits", "withdrawals", "users", "daily"] as const
type Kind = (typeof KINDS)[number]

type MoneyRow = { id: string; user_id: string; amount: number | string; status: string; created_at: string } & Record<
  string,
  unknown
>
type UserRow = { id: string; full_name: string | null; email: string | null; phone: string | null; created_at: string }

let cachedClient: SupabaseClient | null = null
function getClient() {
  cachedClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedClient
}

const dayKey = (iso: string) => new Date(Date.parse(iso) - TZ_OFFSET_MS).toISOString().slice(0, 10)
const round2 = (n: number) => Math.round(n * 100) / 100

async function fetchRange<T>(table: string, columns: string, startISO: string, endISO: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await getClient()
      .from(table)
      .select(columns)
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

async function profilesById(ids: string[]) {
  const map = new Map<string, { full_name: string | null; email: string | null }>()
  const unique = [...new Set(ids)]
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await getClient()
      .from("profiles")
      .select("id, full_name, email")
      .in("id", unique.slice(i, i + 200))
    for (const p of data ?? []) map.set(p.id, p)
  }
  return map
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ""
  const s = String(value)
  // Evita injeção de fórmula ao abrir no Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function toCsv(header: string[], rows: unknown[][]) {
  const lines = [header.map(csvCell).join(";")]
  for (const r of rows) lines.push(r.map(csvCell).join(";"))
  return "\uFEFF" + lines.join("\r\n")
}

const fmtDateTime = (iso: string) =>
  new Date(Date.parse(iso) - TZ_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19)
const fmtMoney = (v: number | string) => Number(v || 0).toFixed(2).replace(".", ",")

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const params = req.nextUrl.searchParams
  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "Periodo invalido" }, { status: 400 })
  }

  const startMs = Date.parse(`${from}T00:00:00Z`) + TZ_OFFSET_MS
  const endMs = Date.parse(`${to}T00:00:00Z`) + TZ_OFFSET_MS + DAY_MS
  const days = Math.round((endMs - startMs) / DAY_MS)
  if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json({ error: `O periodo deve ter entre 1 e ${MAX_DAYS} dias` }, { status: 400 })
  }

  const format = params.get("format")
  const kind = params.get("kind") as Kind | null
  if (format === "csv" && (!kind || !KINDS.includes(kind))) {
    return NextResponse.json({ error: "Tipo de exportacao invalido" }, { status: 400 })
  }

  const startISO = new Date(startMs).toISOString()
  const endISO = new Date(endMs).toISOString()

  try {
    const needDeposits = format !== "csv" || kind === "deposits" || kind === "daily"
    const needWithdrawals = format !== "csv" || kind === "withdrawals" || kind === "daily"
    const needUsers = format !== "csv" || kind === "users" || kind === "daily"
    const detailed = format === "csv" && kind !== "daily"

    const [deposits, withdrawals, users] = await Promise.all([
      needDeposits
        ? fetchRange<MoneyRow>(
            "deposits",
            detailed ? "id, user_id, amount, status, method, payment_method, promo_code, created_at, completed_at" : "id, user_id, amount, status, created_at",
            startISO,
            endISO,
          )
        : [],
      needWithdrawals
        ? fetchRange<MoneyRow>(
            "withdrawals",
            detailed ? "id, user_id, amount, status, method, pix_key_type, holder_name, created_at, processed_at" : "id, user_id, amount, status, created_at",
            startISO,
            endISO,
          )
        : [],
      needUsers ? fetchRange<UserRow>("profiles", "id, full_name, email, phone, created_at", startISO, endISO) : [],
    ])

    const range = `${from}_a_${to}`

    if (format === "csv" && kind === "deposits") {
      const names = await profilesById(deposits.map((d) => d.user_id))
      const csv = toCsv(
        ["Data", "Usuario", "Email", "Valor (R$)", "Status", "Metodo", "Cupom", "Concluido em", "ID"],
        deposits.map((d) => [
          fmtDateTime(d.created_at),
          names.get(d.user_id)?.full_name,
          names.get(d.user_id)?.email,
          fmtMoney(d.amount),
          d.status,
          d.payment_method || d.method,
          d.promo_code,
          d.completed_at ? fmtDateTime(String(d.completed_at)) : "",
          d.id,
        ]),
      )
      return csvResponse(csv, `depositos_${range}.csv`)
    }

    if (format === "csv" && kind === "withdrawals") {
      const names = await profilesById(withdrawals.map((w) => w.user_id))
      const csv = toCsv(
        ["Data", "Usuario", "Email", "Valor (R$)", "Status", "Metodo", "Tipo chave", "Titular", "Processado em", "ID"],
        withdrawals.map((w) => [
          fmtDateTime(w.created_at),
          names.get(w.user_id)?.full_name,
          names.get(w.user_id)?.email,
          fmtMoney(w.amount),
          w.status,
          w.method,
          w.pix_key_type,
          w.holder_name,
          w.processed_at ? fmtDateTime(String(w.processed_at)) : "",
          w.id,
        ]),
      )
      return csvResponse(csv, `saques_${range}.csv`)
    }

    if (format === "csv" && kind === "users") {
      const csv = toCsv(
        ["Cadastro", "Nome", "Email", "Telefone", "ID"],
        users.map((u) => [fmtDateTime(u.created_at), u.full_name, u.email, u.phone, u.id]),
      )
      return csvResponse(csv, `novos_usuarios_${range}.csv`)
    }

    const daily = new Map<string, DailyRow>()
    for (let t = startMs; t < endMs; t += DAY_MS) {
      const key = new Date(t - TZ_OFFSET_MS).toISOString().slice(0, 10)
      daily.set(key, { date: key, depositos: 0, depositosQtd: 0, saques: 0, saquesQtd: 0, usuarios: 0 })
    }

    let depApproved = 0
    let depApprovedCount = 0
    let depPending = 0
    let depPendingCount = 0
    const depositors = new Set<string>()
    for (const d of deposits) {
      const amount = Number(d.amount) || 0
      if (APPROVED.has(d.status)) {
        depApproved += amount
        depApprovedCount++
        depositors.add(d.user_id)
        const row = daily.get(dayKey(d.created_at))
        if (row) {
          row.depositos += amount
          row.depositosQtd++
        }
      } else if (d.status === "pending") {
        depPending += amount
        depPendingCount++
      }
    }

    let wdApproved = 0
    let wdApprovedCount = 0
    let wdPending = 0
    let wdPendingCount = 0
    for (const w of withdrawals) {
      const amount = Number(w.amount) || 0
      if (APPROVED.has(w.status)) {
        wdApproved += amount
        wdApprovedCount++
        const row = daily.get(dayKey(w.created_at))
        if (row) {
          row.saques += amount
          row.saquesQtd++
        }
      } else if (w.status === "pending") {
        wdPending += amount
        wdPendingCount++
      }
    }

    const newUserIds = new Set<string>()
    for (const u of users) {
      newUserIds.add(u.id)
      const row = daily.get(dayKey(u.created_at))
      if (row) row.usuarios++
    }
    let convertedUsers = 0
    for (const id of depositors) if (newUserIds.has(id)) convertedUsers++

    const dailyRows = [...daily.values()].map((r) => ({
      ...r,
      depositos: round2(r.depositos),
      saques: round2(r.saques),
      liquido: round2(r.depositos - r.saques),
    }))

    if (format === "csv") {
      const csv = toCsv(
        ["Data", "Depositos (R$)", "Qtd depositos", "Saques (R$)", "Qtd saques", "Liquido (R$)", "Novos usuarios"],
        dailyRows.map((r) => [
          r.date.split("-").reverse().join("/"),
          fmtMoney(r.depositos),
          r.depositosQtd,
          fmtMoney(r.saques),
          r.saquesQtd,
          fmtMoney(r.liquido),
          r.usuarios,
        ]),
      )
      return csvResponse(csv, `resumo_diario_${range}.csv`)
    }

    return NextResponse.json(
      {
        from,
        to,
        days,
        summary: {
          deposits: { total: round2(depApproved), count: depApprovedCount, pending: round2(depPending), pendingCount: depPendingCount },
          withdrawals: { total: round2(wdApproved), count: wdApprovedCount, pending: round2(wdPending), pendingCount: wdPendingCount },
          net: round2(depApproved - wdApproved),
          avgDeposit: depApprovedCount ? round2(depApproved / depApprovedCount) : 0,
          newUsers: users.length,
          convertedUsers,
          conversionRate: users.length ? round2((convertedUsers / users.length) * 100) : 0,
        },
        daily: dailyRows,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (err) {
    console.error("[admin/reports]", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Falha ao gerar relatorio" }, { status: 500 })
  }
}

type DailyRow = {
  date: string
  depositos: number
  depositosQtd: number
  saques: number
  saquesQtd: number
  usuarios: number
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
