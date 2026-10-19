export const SUPPORT_CATEGORIES = [
  { key: "saques", emoji: "💸", label: "Problemas com saques", short: "Saques" },
  { key: "depositos", emoji: "💰", label: "Problemas com depósitos", short: "Depósitos" },
  { key: "tecnico", emoji: "🎮", label: "Plataforma travando ou apresentando erros", short: "Problemas técnicos" },
  { key: "acesso", emoji: "🔐", label: "Problemas com senha ou acesso à conta", short: "Senha e acesso" },
  { key: "recuperacao", emoji: "👤", label: "Recuperação de conta", short: "Recuperação de conta" },
  { key: "operacoes", emoji: "📊", label: "Problemas com operações", short: "Operações" },
  { key: "outro", emoji: "❓", label: "Outro assunto", short: "Outros assuntos" },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["key"]

export const CATEGORY_KEYS = SUPPORT_CATEGORIES.map((c) => c.key) as [SupportCategory, ...SupportCategory[]]

export function getCategory(key: string | null | undefined) {
  return SUPPORT_CATEGORIES.find((c) => c.key === key) ?? null
}

export const SUPPORT_STATUSES = [
  { key: "new", label: "Novo" },
  { key: "waiting_agent", label: "Aguardando atendente" },
  { key: "in_progress", label: "Em atendimento" },
  { key: "waiting_customer", label: "Aguardando cliente" },
  { key: "completed", label: "Concluído" },
] as const

export type SupportStatus = (typeof SUPPORT_STATUSES)[number]["key"]

export const STATUS_KEYS = SUPPORT_STATUSES.map((s) => s.key) as [SupportStatus, ...SupportStatus[]]

export function getStatusLabel(key: string | null | undefined) {
  return SUPPORT_STATUSES.find((s) => s.key === key)?.label ?? "—"
}

export const WELCOME_MESSAGE =
  "Olá! 👋 Seja bem-vindo ao suporte da nossa plataforma!\n\nPara direcionarmos seu atendimento, selecione abaixo o assunto que você precisa resolver:"

export const CONFIRMATION_MESSAGE =
  "Perfeito! Agora descreva o seu problema com o máximo de detalhes (o que aconteceu, valor e data, se houver). Assim que você enviar, um atendente analisa e responde por aqui em tempo real."

export const CLOSED_MESSAGE =
  "✅ Seu atendimento foi concluído!\n\nSe precisar de ajuda novamente, estamos à disposição. Clique abaixo para iniciar um novo atendimento."

export const REOPENED_MESSAGE = "Seu atendimento foi reaberto pela nossa equipe. Você já pode responder por aqui."

export const MAX_MESSAGE_LENGTH = 4000

export const STAFF_TOPIC = "support-staff"
export const userTopic = (userId: string) => `support-user-${userId}`

export type SupportMessage = {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role: "customer" | "agent" | "system"
  kind: "text" | "welcome" | "category" | "confirmation" | "closed" | "reopened"
  message: string
  created_at: string
  read_at: string | null
}
