"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import {
  AlertCircle,
  ArrowLeft,
  CheckCheck,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  NotebookPen,
  RotateCcw,
  Send,
  UserRound,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  IMAGE_ONLY_MESSAGE,
  MAX_MESSAGE_LENGTH,
  SUPPORT_IMAGE_MAX_BYTES,
  SUPPORT_IMAGE_TYPES,
  SUPPORT_STATUSES,
  getCategory,
} from "@/lib/support/constants"
import {
  formatDateTime,
  formatDayLabel,
  formatTime,
  isComposingEnter,
  newMessageId,
  supportFetch,
  supportFetcher,
} from "@/lib/support/client"
import { cn } from "@/lib/utils"
import { StatusBadge } from "./conversation-list"
import type { Agent, DetailResponse, StaffInfo } from "./types"

type Props = {
  conversationId: string
  staff: StaffInfo
  agents: Agent[]
  onBack: () => void
  onChanged: () => void
}

export function ConversationPanel({ conversationId, staff, agents, onBack, onChanged }: Props) {
  const key = `/api/support/staff/conversations/${conversationId}`
  const { data, error, isLoading, mutate } = useSWR<DetailResponse>(key, supportFetcher, {
    refreshInterval: 30_000,
    keepPreviousData: false,
  })
  const [tab, setTab] = useState<"chat" | "notes">("chat")
  const [confirmClose, setConfirmClose] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const conversation = data?.conversation.id === conversationId ? data.conversation : null
  const messages = conversation ? data!.messages : []
  const completed = conversation?.status === "completed"
  const isAdmin = staff.role === "admin"
  const assignedToOther = !!conversation?.assigned_agent_id && conversation.assigned_agent_id !== staff.id
  const canManage = isAdmin || !assignedToOther

  const unreadCustomer = messages.some((m) => m.sender_role === "customer" && !m.read_at)
  const markingRef = useRef(false)
  useEffect(() => {
    if (!unreadCustomer || markingRef.current) return
    markingRef.current = true
    supportFetch(`${key}/read`, { method: "POST" })
      .then(() => {
        mutate()
        onChanged()
      })
      .catch(() => {})
      .finally(() => {
        markingRef.current = false
      })
  }, [unreadCustomer, key, mutate, onChanged])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, tab, conversationId])

  const runAction = async (action: string, extra: Record<string, unknown> = {}, success?: string) => {
    setBusy(action)
    try {
      await supportFetch(`${key}/actions`, { method: "POST", body: JSON.stringify({ action, ...extra }) })
      if (success) toast.success(success)
      await mutate()
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (error && !conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="size-6 text-red-400" aria-hidden />
        <p className="text-sm text-white/70">{(error as Error).message}</p>
        <button type="button" onClick={() => mutate()} className="h-11 rounded-lg bg-white/10 px-4 text-sm text-white">
          Tentar novamente
        </button>
      </div>
    )
  }

  if (isLoading || !conversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" aria-label="Carregando atendimento" />
      </div>
    )
  }

  const category = getCategory(conversation.category)
  const customerName = conversation.customer_name || conversation.customer_username || "Cliente"

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Atendimento #${conversation.number}`}>
      <header className="flex flex-col gap-3 border-b border-white/[0.06] p-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para a lista"
            className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/5 lg:hidden"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-bold text-white">{customerName}</h2>
              <StatusBadge status={conversation.status} />
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-white/50">
              <span>#{conversation.number}</span>
              {conversation.customer_username && <span>@{conversation.customer_username}</span>}
              {conversation.account_id && <span>Conta {conversation.account_id}</span>}
              {conversation.customer_email && <span className="break-all">{conversation.customer_email}</span>}
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              {category ? `${category.emoji} ${category.label}` : "Categoria não selecionada"} · Aberto{" "}
              {formatDateTime(conversation.created_at)} · {conversation.customer_total_conversations} atendimento(s)
            </p>
            <p className="mt-0.5 break-all text-[10px] text-white/25">ID {conversation.id}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 basis-40 items-center gap-2 rounded-lg border border-white/10 bg-[#11161f] px-2">
            <UserRound className="size-4 shrink-0 text-white/40" aria-hidden />
            <span className="sr-only">Atendente responsável</span>
            <select
              value={conversation.assigned_agent_id ?? ""}
              disabled={completed || !!busy || (!isAdmin && assignedToOther)}
              onChange={(e) =>
                runAction("assign", { agentId: e.target.value || null }, e.target.value ? "Atendimento atribuído." : "Atribuição removida.")
              }
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-white outline-none disabled:opacity-60 md:text-sm"
            >
              <option value="">Sem responsável</option>
              {agents
                .filter((a) => a.active || a.id === conversation.assigned_agent_id)
                .filter((a) => isAdmin || a.id === staff.id || a.id === conversation.assigned_agent_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id === staff.id ? `${a.name} (você)` : a.name}
                  </option>
                ))}
            </select>
          </label>

          {!completed && (
            <label className="flex min-w-0 flex-1 basis-40 rounded-lg border border-white/10 bg-[#11161f] px-2">
              <span className="sr-only">Status do atendimento</span>
              <select
                value={conversation.status === "new" ? "" : conversation.status}
                disabled={!!busy || !canManage}
                onChange={(e) => e.target.value && runAction("status", { status: e.target.value }, "Status atualizado.")}
                className="h-11 min-w-0 flex-1 bg-transparent text-base text-white outline-none disabled:opacity-60 md:text-sm"
              >
                {conversation.status === "new" && <option value="">Novo</option>}
                {SUPPORT_STATUSES.filter((s) => !["new", "completed"].includes(s.key)).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {completed ? (
            <button
              type="button"
              disabled={!!busy || !canManage}
              onClick={() => runAction("reopen", {}, "Atendimento reaberto.")}
              className="flex h-11 items-center gap-2 rounded-lg border border-[#f97316]/40 px-3 text-sm font-semibold text-[#fdba74] hover:bg-[#f97316]/10 disabled:opacity-50"
            >
              {busy === "reopen" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Reabrir atendimento
            </button>
          ) : (
            <button
              type="button"
              disabled={!!busy || !canManage}
              onClick={() => setConfirmClose(true)}
              className="flex h-11 items-center gap-2 rounded-lg bg-red-500/15 px-3 text-sm font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
            >
              {busy === "close" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Encerrar atendimento
            </button>
          )}
        </div>

        {assignedToOther && !completed && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Este atendimento está com {conversation.assigned_agent_name ?? "outro atendente"}.
            {isAdmin ? " Como administrador, você ainda pode responder ou transferir." : " Apenas ele ou um administrador pode responder."}
          </p>
        )}
        {completed && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Concluído em {formatDateTime(conversation.closed_at)}
            {conversation.closed_by_name ? ` por ${conversation.closed_by_name}` : ""}. Somente leitura.
          </p>
        )}

        <div role="tablist" className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
          {(
            [
              ["chat", "Conversa"],
              ["notes", `Notas internas${data!.notes.length ? ` (${data!.notes.length})` : ""}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "h-9 flex-1 rounded-md text-sm font-medium transition-colors",
                tab === value ? "bg-[#f97316] text-white" : "text-white/60 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        {tab === "chat" ? (
          <MessageList messages={messages} />
        ) : (
          <NotesList notes={data!.notes} />
        )}
      </div>

      {tab === "chat" ? (
        !completed && (canManage || isAdmin) ? (
          <AgentComposer
            key={conversationId}
            conversationId={conversationId}
            canSendImages={isAdmin}
            onSent={() => (mutate(), onChanged())}
          />
        ) : null
      ) : (
        <NoteComposer key={`n-${conversationId}`} conversationId={conversationId} onSaved={() => mutate()} />
      )}

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="border-white/10 bg-[#11161f] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar atendimento #{conversation.number}?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Tem certeza de que deseja encerrar este atendimento? A conversa será marcada como concluída, e o cliente poderá
              iniciar um novo atendimento quando precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 border-white/10 bg-transparent text-white hover:bg-white/5 hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-red-500 text-white hover:bg-red-600"
              onClick={() => runAction("close", {}, "Atendimento encerrado.")}
            >
              Confirmar encerramento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function MessageList({ messages }: { messages: DetailResponse["messages"] }) {
  if (!messages.length) return <p className="py-8 text-center text-sm text-white/40">Nenhuma mensagem ainda.</p>
  let lastDay = ""
  return (
    <ol className="flex flex-col gap-2">
      {messages.map((m) => {
        const day = formatDayLabel(m.created_at)
        const showDay = day !== lastDay
        lastDay = day
        return (
          <li key={m.id} className="flex flex-col">
            {showDay && (
              <span className="mx-auto my-2 rounded-full bg-white/5 px-3 py-1 text-[11px] text-white/45">{day}</span>
            )}
            {m.sender_role === "system" ? (
              <p className="mx-auto max-w-[90%] whitespace-pre-wrap rounded-lg bg-white/[0.04] px-3 py-2 text-center text-xs text-white/50">
                {m.message}
              </p>
            ) : (
              <div className={cn("flex flex-col", m.sender_role === "agent" ? "items-end" : "items-start")}>
                {m.sender_role === "agent" && <span className="mb-0.5 text-[11px] text-white/40">{m.sender_name}</span>}
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    m.sender_role === "agent"
                      ? "rounded-br-md bg-[#f97316] text-white"
                      : "rounded-bl-md border border-white/[0.06] bg-[#1A1F2E] text-white/90",
                  )}
                >
                  {m.image_url && (
                    <a href={m.image_url} target="_blank" rel="noopener noreferrer" className="-mx-1.5 -mt-0.5 mb-1 block">
                      <img
                        src={m.image_url || "/placeholder.svg"}
                        alt="Foto enviada pela equipe"
                        loading="lazy"
                        className="max-h-72 w-full rounded-xl object-cover"
                      />
                    </a>
                  )}
                  {!(m.image_url && m.message === IMAGE_ONLY_MESSAGE) && m.message}
                  <span
                    className={cn(
                      "mt-1 flex items-center justify-end gap-1 text-[10px]",
                      m.sender_role === "agent" ? "text-white/75" : "text-white/40",
                    )}
                  >
                    {formatTime(m.created_at)}
                    {m.sender_role === "agent" &&
                      (m.read_at ? (
                        <CheckCheck className="size-3.5" aria-label="Lida pelo cliente" />
                      ) : (
                        <Check className="size-3.5" aria-label="Enviada" />
                      ))}
                  </span>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function NotesList({ notes }: { notes: DetailResponse["notes"] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        <NotebookPen className="size-3.5 shrink-0" aria-hidden />
        Notas internas são visíveis apenas para a equipe e nunca aparecem para o cliente.
      </p>
      {notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">Nenhuma nota registrada.</p>
      ) : (
        notes.map((n) => (
          <article key={n.id} className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
            <p className="whitespace-pre-wrap break-words text-sm text-white/85">{n.note}</p>
            <p className="mt-1.5 text-[11px] text-white/40">
              {n.author} · {formatDateTime(n.created_at)}
            </p>
          </article>
        ))
      )}
    </div>
  )
}

function AgentComposer({
  conversationId,
  canSendImages,
  onSent,
}: {
  conversationId: string
  canSendImages: boolean
  onSent: () => void
}) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null)
  const pendingId = useRef<string | null>(null)
  const uploadedUrl = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!image) return
    return () => URL.revokeObjectURL(image.preview)
  }, [image])

  const pickImage = (file: File | undefined) => {
    if (!file) return
    if (!SUPPORT_IMAGE_TYPES[file.type]) return setError("Use JPG, PNG, WEBP ou GIF.")
    if (file.size > SUPPORT_IMAGE_MAX_BYTES) return setError("A imagem deve ter no máximo 5MB.")
    setError("")
    uploadedUrl.current = null
    pendingId.current = null
    setImage({ file, preview: URL.createObjectURL(file) })
  }

  const clearImage = () => {
    setImage(null)
    uploadedUrl.current = null
    pendingId.current = null
  }

  const send = async () => {
    const message = text.trim()
    if ((!message && !image) || sending) return
    pendingId.current ??= newMessageId()
    setSending(true)
    setError("")
    try {
      if (image && !uploadedUrl.current) {
        const form = new FormData()
        form.append("file", image.file)
        const res = await fetch("/api/support/staff/upload", { method: "POST", body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || "Não foi possível enviar a imagem.")
        uploadedUrl.current = data.url as string
      }
      await supportFetch(`/api/support/staff/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ id: pendingId.current, message, imageUrl: uploadedUrl.current ?? undefined }),
      })
      pendingId.current = null
      setText("")
      clearImage()
      onSent()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      className="border-t border-white/[0.06] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {error && (
        <p role="alert" className="mb-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="size-3.5" aria-hidden />
          {error} A mensagem não foi enviada.
        </p>
      )}
      {image && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-[#11161f] p-2">
          <img src={image.preview || "/placeholder.svg"} alt="Prévia da foto" className="size-14 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white/85">{image.file.name}</p>
            <p className="text-xs text-white/45">Adicione uma legenda (opcional)</p>
          </div>
          <button
            type="button"
            onClick={clearImage}
            disabled={sending}
            aria-label="Remover foto"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        {canSendImages && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                pickImage(e.target.files?.[0])
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={sending}
              aria-label="Enviar foto"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#11161f] text-white/70 transition hover:text-white disabled:opacity-40"
            >
              <ImagePlus className="size-5" />
            </button>
          </>
        )}
        <label htmlFor="agent-reply" className="sr-only">
          Responder ao cliente
        </label>
        <textarea
          id="agent-reply"
          rows={1}
          value={text}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => {
            setText(e.target.value)
            pendingId.current = null
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isComposingEnter(e)) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Digite sua resposta..."
          className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-[#11161f] px-3 py-2.5 text-base text-white outline-none [field-sizing:content] placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[#f97316] md:text-sm"
        />
        <button
          type="submit"
          disabled={sending || (!text.trim() && !image)}
          aria-label="Enviar resposta"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#f97316] text-white transition hover:bg-[#ea580c] disabled:opacity-40"
        >
          {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        </button>
      </div>
    </form>
  )
}

function NoteComposer({ conversationId, onSaved }: { conversationId: string; onSaved: () => void }) {
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!note.trim() || saving) return
    setSaving(true)
    try {
      await supportFetch(`/api/support/staff/conversations/${conversationId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() }),
      })
      setNote("")
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="flex items-end gap-2 border-t border-white/[0.06] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <label htmlFor="internal-note" className="sr-only">
        Nova nota interna
      </label>
      <textarea
        id="internal-note"
        rows={1}
        value={note}
        maxLength={2000}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Adicionar nota interna..."
        className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-amber-500/20 bg-[#11161f] px-3 py-2.5 text-base text-white outline-none [field-sizing:content] placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-amber-400 md:text-sm"
      />
      <button
        type="submit"
        disabled={saving || !note.trim()}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 text-sm font-semibold text-amber-200 disabled:opacity-40"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <NotebookPen className="size-4" />}
        Salvar
      </button>
    </form>
  )
}
