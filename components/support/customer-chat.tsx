"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  Headset,
  Loader2,
  PencilLine,
  RotateCcw,
  SendHorizonal,
  ShieldCheck,
} from "lucide-react"
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

type Stage = "category" | "describe" | "waiting" | "chat" | "closed"

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

  const stage: Stage = useMemo(() => {
    if (!conversation) return "category"
    if (isCompleted) return "closed"
    if (!conversation.category) return "category"
    const hasDescription = messages.some((m) => m.sender_role === "customer" && m.kind === "text")
    if (!hasDescription) return "describe"
    const hasAgentReply = messages.some((m) => m.sender_role === "agent")
    return hasAgentReply ? "chat" : "waiting"
  }, [conversation, isCompleted, messages])

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
      <ChatHeader conversation={conversation} stage={stage} />

      {isLoading ? (
        <CenteredState>
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Carregando atendimento...</p>
        </CenteredState>
      ) : unauthorized ? (
        <CenteredState>
          <IconBubble />
          <h2 className="text-lg font-semibold text-balance">Entre na sua conta</h2>
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
          <h2 className="text-xl font-semibold text-balance">Como podemos ajudar?</h2>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
            Conte o que está acontecendo e um atendente responde por aqui, em tempo real.
          </p>
          <Button className="mt-3 h-12 w-full max-w-xs rounded-xl text-base" onClick={startConversation} disabled={starting}>
            {starting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Iniciar atendimento
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            Conversa privada entre você e nossa equipe
          </p>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        </CenteredState>
      ) : (
        <>
          <MessageList
            messages={messages}
            stage={stage}
            choosing={choosing}
            onChoose={chooseCategory}
            onRetry={(m) => sendMessage(m.message, m.id)}
            footer={
              stage === "closed" ? (
                <div className="flex justify-center pt-4">
                  <Button className="h-12 rounded-xl px-6" onClick={startConversation} disabled={starting}>
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
            stage={stage}
            disabled={stage === "closed" || stage === "category"}
            placeholder={
              stage === "closed"
                ? "Atendimento concluído"
                : stage === "category"
                  ? "Escolha um assunto acima"
                  : stage === "describe"
                    ? "Descreva seu problema aqui..."
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

function ChatHeader({ conversation, stage }: { conversation: MeResponse["conversation"]; stage: Stage }) {
  const category = getCategory(conversation?.category)
  const online = !!conversation?.agentName && stage !== "closed"
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card/80 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
      <Link
        href="/trade"
        aria-label="Voltar"
        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <div className="relative shrink-0">
        <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
          <Headset className="size-5" aria-hidden />
        </div>
        <span
          aria-hidden
          className={cn(
            "absolute right-0 bottom-0 size-3 rounded-full border-2 border-card",
            online ? "bg-emerald-500" : stage === "closed" ? "bg-muted-foreground" : "bg-amber-400",
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">{conversation?.agentName ?? "Suporte"}</h1>
        <p className="truncate text-xs text-muted-foreground">
          {conversation
            ? online
              ? "Online agora · respondendo"
              : `${category ? category.short : "Novo atendimento"} · ${getStatusLabel(conversation.status)}`
            : "Atendimento ao cliente"}
        </p>
      </div>
      {conversation && (
        <span className="mr-2 shrink-0 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums">
          #{conversation.number}
        </span>
      )}
    </header>
  )
}

function MessageList({
  messages,
  stage,
  choosing,
  onChoose,
  onRetry,
  footer,
}: {
  messages: LocalMessage[]
  stage: Stage
  choosing: string | null
  onChoose: (key: string) => void
  onRetry: (m: LocalMessage) => void
  footer: React.ReactNode
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const lastId = messages.at(-1)?.id

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [lastId, stage])

  return (
    <div
      className="flex-1 overflow-y-auto overscroll-contain px-3 py-4"
      role="log"
      aria-live="polite"
      aria-label="Mensagens do atendimento"
    >
      <ol className="flex flex-col gap-1.5">
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const showDay = !prev || formatDayLabel(prev.created_at) !== formatDayLabel(m.created_at)
          const sideOf = (x?: LocalMessage) => (x ? (x.sender_role === "customer" ? "me" : "them") : null)
          const lastInGroup = sideOf(next) !== sideOf(m)
          return (
            <li key={m.id} className={cn("flex flex-col gap-2", lastInGroup && "mb-2")}>
              {showDay && (
                <span className="mx-auto my-1 rounded-full bg-muted/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {formatDayLabel(m.created_at)}
                </span>
              )}
              <MessageBubble message={m} showAvatar={lastInGroup} onRetry={onRetry} />
              {m.kind === "welcome" && stage === "category" && <CategoryOptions choosing={choosing} onChoose={onChoose} />}
            </li>
          )
        })}
      </ol>

      {stage === "describe" && <DescribeHint />}
      {stage === "waiting" && <AnalyzingIndicator />}
      {footer}
      <div ref={endRef} />
    </div>
  )
}

function BotAvatar({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center self-end rounded-full bg-primary/15 text-primary",
        !visible && "invisible",
      )}
    >
      <Headset className="size-3.5" />
    </div>
  )
}

function MessageBubble({
  message,
  showAvatar,
  onRetry,
}: {
  message: LocalMessage
  showAvatar: boolean
  onRetry: (m: LocalMessage) => void
}) {
  const mine = message.sender_role === "customer"
  const isSystem = message.sender_role === "system"
  const isCategoryChoice = mine && message.kind === "category"

  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end pl-10" : "justify-start pr-10")}>
      {!mine && <BotAvatar visible={showAvatar} />}
      <div
        className={cn(
          "max-w-full rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm",
          mine
            ? "bg-primary text-primary-foreground"
            : isSystem
              ? "border border-border bg-card text-card-foreground"
              : "bg-muted text-foreground",
          mine && showAvatar && "rounded-br-md",
          !mine && showAvatar && "rounded-bl-md",
          isCategoryChoice && "font-medium",
          message.failed && "opacity-70",
        )}
      >
        {!mine && !isSystem && showAvatar && (
          <span className="mb-0.5 block text-[11px] font-semibold text-primary">Atendente</span>
        )}
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
    <div className="flex flex-col gap-2 pl-9" role="group" aria-label="Assuntos do atendimento">
      {SUPPORT_CATEGORIES.map((c) => (
        <button
          key={c.key}
          type="button"
          disabled={!!choosing}
          onClick={() => onChoose(c.key)}
          className="group flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium transition-all hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99] disabled:opacity-60"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-base transition-colors group-hover:bg-primary/15"
          >
            {c.emoji}
          </span>
          <span className="flex-1 leading-snug">{c.label}</span>
          {choosing === c.key ? (
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          )}
        </button>
      ))}
    </div>
  )
}

function DescribeHint() {
  return (
    <div className="mt-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <PencilLine className="size-4" aria-hidden />
        Descreva seu problema
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm leading-relaxed text-muted-foreground">
        <li>{"• O que aconteceu e quando"}</li>
        <li>{"• Valores envolvidos, se houver"}</li>
        <li>{"• Mensagens de erro que apareceram"}</li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Use o campo abaixo para escrever.</p>
    </div>
  )
}

function AnalyzingIndicator() {
  return (
    <div className="mt-1 flex items-end gap-2" role="status">
      <BotAvatar visible />
      <div className="flex flex-col gap-1">
        <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              aria-hidden
              className="size-2 animate-bounce rounded-full bg-muted-foreground/70"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Um atendente está analisando sua mensagem...</p>
      </div>
    </div>
  )
}

function Composer({
  stage,
  disabled,
  placeholder,
  onSend,
}: {
  stage: Stage
  disabled: boolean
  placeholder: string
  onSend: (text: string) => void
}) {
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (stage === "describe") ref.current?.focus()
  }, [stage])

  const submit = () => {
    const value = text.trim()
    if (!value || disabled) return
    onSend(value)
    setText("")
    ref.current?.focus()
  }

  const highlight = stage === "describe"

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-end gap-2 border-t border-border bg-card/80 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      <label htmlFor="support-message" className="sr-only">
        Mensagem
      </label>
      <textarea
        id="support-message"
        ref={ref}
        rows={highlight ? 2 : 1}
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
        className={cn(
          "field-sizing-content max-h-32 min-h-11 flex-1 resize-none rounded-2xl border bg-background px-4 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          highlight ? "border-primary/60" : "border-input",
        )}
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
    <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/20">
      <Headset className="size-9" aria-hidden />
    </div>
  )
}
