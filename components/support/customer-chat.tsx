"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Check, CheckCheck, Headset, Loader2, RotateCcw, SendHorizonal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  MAX_MESSAGE_LENGTH,
  SUPPORT_CATEGORIES,
  type SupportMessage,
  getCategory,
  getStatusLabel,
  userTopic,
} from "@/lib/support/constants"
import {
  SupportRequestError,
  formatDayLabel,
  formatTime,
  isComposingEnter,
  newMessageId,
  supportFetch,
  supportFetcher,
  useSupportSignal,
} from "@/lib/support/client"
import { cn } from "@/lib/utils"

type MeResponse = {
  userId: string
  conversation: {
    id: string
    number: number
    category: string | null
    status: string
    createdAt: string
    closedAt: string | null
    agentName: string | null
  } | null
  messages: SupportMessage[]
  unreadCount: number
}

type LocalMessage = SupportMessage & { pending?: boolean; failed?: boolean }

export function CustomerChat() {
  const { data, error, isLoading, mutate } = useSWR<MeResponse>("/api/support/me", supportFetcher, {
    revalidateOnFocus: true,
    refreshInterval: 30_000,
  })
  const [local, setLocal] = useState<LocalMessage[]>([])
  const [starting, setStarting] = useState(false)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [actionError, setActionError] = useState("")

  const conversation = data?.conversation ?? null
  const isCompleted = conversation?.status === "completed"

  useSupportSignal(data?.userId ? userTopic(data.userId) : null, () => {
    mutate()
  })

  const messages = useMemo(() => {
    const server = data?.messages ?? []
    const ids = new Set(server.map((m) => m.id))
    const extra = local.filter((m) => !ids.has(m.id) && m.conversation_id === conversation?.id)
    return [...server, ...extra]
  }, [data?.messages, local, conversation?.id])

  const unread = data?.unreadCount ?? 0
  useEffect(() => {
    if (!conversation || unread === 0) return
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return
    supportFetch(`/api/support/conversations/${conversation.id}/read`, { method: "POST" })
      .then(() => mutate())
      .catch(() => {})
  }, [conversation, unread, mutate])

  const startConversation = useCallback(async () => {
    setStarting(true)
    setActionError("")
    try {
      await supportFetch("/api/support/conversations", { method: "POST", body: "{}" })
      setLocal([])
      await mutate()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }, [mutate])

  const chooseCategory = async (key: string) => {
    if (!conversation || choosing) return
    setChoosing(key)
    setActionError("")
    try {
      await supportFetch(`/api/support/conversations/${conversation.id}/category`, {
        method: "POST",
        body: JSON.stringify({ category: key }),
      })
      await mutate()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setChoosing(null)
    }
  }

  const sendMessage = async (text: string, existingId?: string) => {
    if (!conversation || !data) return
    const id = existingId ?? newMessageId()
    const optimistic: LocalMessage = {
      id,
      conversation_id: conversation.id,
      sender_id: data.userId,
      sender_role: "customer",
      kind: "text",
      message: text,
      created_at: new Date().toISOString(),
      read_at: null,
      pending: true,
    }
    setLocal((prev) => [...prev.filter((m) => m.id !== id), optimistic])
    try {
      await supportFetch(`/api/support/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ id, message: text }),
      })
      await mutate()
      setLocal((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setLocal((prev) => prev.map((m) => (m.id === id ? { ...m, pending: false, failed: true } : m)))
      if (e instanceof SupportRequestError && e.status === 409) mutate()
      setActionError((e as Error).message)
    }
  }

  const unauthorized = error instanceof SupportRequestError && error.status === 401

  return (
    <main className="flex h-dvh flex-col bg-background text-foreground">
      <ChatHeader conversation={conversation} />

      {isLoading ? (
        <CenteredState>
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Carregando atendimento...</p>
        </CenteredState>
      ) : unauthorized ? (
        <CenteredState>
          <IconBubble />
          <h2 className="text-lg font-semibold">Entre na sua conta</h2>
          <p className="max-w-xs text-sm text-muted-foreground">Faça login para conversar com nossa equipe de suporte.</p>
          <Button asChild className="mt-2 h-11 px-6">
            <Link href="/login">Fazer login</Link>
          </Button>
        </CenteredState>
      ) : error ? (
        <CenteredState>
          <p className="max-w-xs text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" className="h-11 px-6" onClick={() => mutate()}>
            Tentar novamente
          </Button>
        </CenteredState>
      ) : !conversation ? (
        <CenteredState>
          <IconBubble />
          <h2 className="text-lg font-semibold">Como podemos ajudar?</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Inicie uma conversa e nossa equipe responde por aqui mesmo.
          </p>
          <Button className="mt-2 h-11 px-6" onClick={startConversation} disabled={starting}>
            {starting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Iniciar atendimento
          </Button>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        </CenteredState>
      ) : (
        <>
          <MessageList
            messages={messages}
            needsCategory={!conversation.category && !isCompleted}
            choosing={choosing}
            onChoose={chooseCategory}
            onRetry={(m) => sendMessage(m.message, m.id)}
            footer={
              isCompleted ? (
                <div className="flex justify-center pt-2">
                  <Button className="h-11 px-6" onClick={startConversation} disabled={starting}>
                    {starting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                    Iniciar novo atendimento
                  </Button>
                </div>
              ) : null
            }
          />
          {actionError && (
            <p role="alert" className="px-4 pb-1 text-center text-xs text-destructive">
              {actionError}
            </p>
          )}
          <Composer
            disabled={isCompleted || !conversation.category}
            placeholder={
              isCompleted
                ? "Atendimento concluído"
                : !conversation.category
                  ? "Selecione um assunto acima"
                  : "Digite sua mensagem"
            }
            onSend={(text) => {
              setActionError("")
              sendMessage(text)
            }}
          />
        </>
      )}
    </main>
  )
}

function ChatHeader({ conversation }: { conversation: MeResponse["conversation"] }) {
  const category = getCategory(conversation?.category)
  return (
    <header className="flex items-center gap-3 border-b border-border bg-background/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
      <Link
        href="/trade"
        aria-label="Voltar"
        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Headset className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">
          {conversation?.agentName ?? "Suporte"}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {conversation
            ? `#${conversation.number} · ${category ? category.short : "Novo atendimento"} · ${getStatusLabel(conversation.status)}`
            : "Atendimento ao cliente"}
        </p>
      </div>
    </header>
  )
}

function MessageList({
  messages,
  needsCategory,
  choosing,
  onChoose,
  onRetry,
  footer,
}: {
  messages: LocalMessage[]
  needsCategory: boolean
  choosing: string | null
  onChoose: (key: string) => void
  onRetry: (m: LocalMessage) => void
  footer: React.ReactNode
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const lastId = messages.at(-1)?.id

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [lastId, needsCategory])

  return (
    <div
      className="flex-1 overflow-y-auto overscroll-contain px-3 py-4"
      role="log"
      aria-live="polite"
      aria-label="Mensagens do atendimento"
    >
      <ol className="flex flex-col gap-2">
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const showDay = !prev || formatDayLabel(prev.created_at) !== formatDayLabel(m.created_at)
          return (
            <li key={m.id} className="flex flex-col gap-2">
              {showDay && (
                <span className="mx-auto rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                  {formatDayLabel(m.created_at)}
                </span>
              )}
              <MessageBubble message={m} onRetry={onRetry} />
              {m.kind === "welcome" && needsCategory && (
                <CategoryOptions choosing={choosing} onChoose={onChoose} />
              )}
            </li>
          )
        })}
      </ol>
      {footer}
      <div ref={endRef} />
    </div>
  )
}

function MessageBubble({ message, onRetry }: { message: LocalMessage; onRetry: (m: LocalMessage) => void }) {
  const mine = message.sender_role === "customer"
  const isSystem = message.sender_role === "system"

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : isSystem
              ? "rounded-bl-md border border-border bg-card text-card-foreground"
              : "rounded-bl-md bg-muted text-foreground",
          message.failed && "opacity-70",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.message}</p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            mine ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
          {mine &&
            (message.pending ? (
              <Loader2 className="size-3 animate-spin" aria-label="Enviando" />
            ) : message.failed ? null : message.read_at ? (
              <CheckCheck className="size-3.5" aria-label="Lida" />
            ) : (
              <Check className="size-3.5" aria-label="Enviada" />
            ))}
        </div>
        {message.failed && (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="mt-1 min-h-8 text-xs font-medium underline underline-offset-2"
          >
            Falhou. Tocar para reenviar
          </button>
        )}
      </div>
    </div>
  )
}

function CategoryOptions({ choosing, onChoose }: { choosing: string | null; onChoose: (key: string) => void }) {
  return (
    <div className="flex flex-col gap-2 pl-1 pr-6" role="group" aria-label="Assuntos do atendimento">
      {SUPPORT_CATEGORIES.map((c) => (
        <button
          key={c.key}
          type="button"
          disabled={!!choosing}
          onClick={() => onChoose(c.key)}
          className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary/60 hover:bg-primary/10 disabled:opacity-60"
        >
          <span aria-hidden className="text-base">
            {c.emoji}
          </span>
          <span className="flex-1">{c.label}</span>
          {choosing === c.key && <Loader2 className="size-4 animate-spin text-primary" aria-hidden />}
        </button>
      ))}
    </div>
  )
}

function Composer({
  disabled,
  placeholder,
  onSend,
}: {
  disabled: boolean
  placeholder: string
  onSend: (text: string) => void
}) {
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const value = text.trim()
    if (!value || disabled) return
    onSend(value)
    setText("")
    ref.current?.focus()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-end gap-2 border-t border-border bg-background px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <label htmlFor="support-message" className="sr-only">
        Mensagem
      </label>
      <textarea
        id="support-message"
        ref={ref}
        rows={1}
        value={text}
        disabled={disabled}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !isComposingEnter(e)) {
            e.preventDefault()
            submit()
          }
        }}
        className="field-sizing-content max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-muted/50 px-4 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !text.trim()}
        className="size-11 shrink-0 rounded-full"
        aria-label="Enviar mensagem"
      >
        <SendHorizonal className="size-5" aria-hidden />
      </Button>
    </form>
  )
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">{children}</section>
}

function IconBubble() {
  return (
    <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
      <Headset className="size-8" aria-hidden />
    </div>
  )
}
