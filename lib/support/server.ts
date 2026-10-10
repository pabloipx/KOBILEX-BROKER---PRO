import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/env"

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function db() {
  return createAdminClient()
}

/** Resolve o cliente logado pelo cookie do Supabase. Nunca confia em ids enviados pelo navegador. */
export async function getCustomer() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user ?? null
  } catch {
    return null
  }
}

const ERRORS: Record<string, { status: number; message: string }> = {
  not_found: { status: 404, message: "Atendimento não encontrado." },
  forbidden: { status: 403, message: "Você não tem acesso a este atendimento." },
  closed: { status: 409, message: "Este atendimento já foi concluído. Inicie um novo atendimento para continuar." },
  category_required: { status: 409, message: "Selecione o assunto do atendimento antes de enviar mensagens." },
  assigned_to_other: { status: 409, message: "Este atendimento está com outro atendente." },
  id_conflict: { status: 409, message: "Conflito de identificador da mensagem. Tente novamente." },
  user_has_active: {
    status: 409,
    message: "O cliente já tem outro atendimento ativo. Conclua-o antes de reabrir este.",
  },
  invalid_role: { status: 400, message: "Requisição inválida." },
}

export function supportError(error: { message?: string } | null | undefined) {
  const match = error?.message?.match(/SUPPORT:([a-z_]+)/)
  const known = match ? ERRORS[match[1]] : undefined
  if (known) return Response.json({ error: known.message, code: match![1] }, { status: known.status })
  console.error("[support] erro de banco:", error?.message)
  return Response.json(
    { error: "Não foi possível concluir a operação agora. Tente novamente em instantes." },
    { status: 503 },
  )
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Sinal de tempo real via Supabase Realtime (broadcast). O payload leva apenas
 * ids e o tipo do evento; o conteúdo é sempre buscado pelas APIs autorizadas.
 * Falhas aqui não afetam a mensagem, que já está salva no banco.
 */
export async function broadcast(events: { topic: string; event: string; payload: Record<string, unknown> }[]) {
  const url = getSupabaseUrl()
  const key = getSupabaseSecretKey()
  if (!url || !key || events.length === 0) return
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: events.map((e) => ({ topic: e.topic, event: e.event, payload: e.payload, private: false })),
      }),
      signal: AbortSignal.timeout(2500),
    })
  } catch (error) {
    console.error("[support] broadcast falhou:", (error as Error).message)
  }
}
