export interface MarketStatus {
  /** true = pode operar; false = mercado fechado */
  open: boolean
  /** motivo curto quando fechado (para exibir na UI) */
  reason?: string
  /** próxima abertura (quando fechado) */
  nextOpen?: Date
  /** próximo fechamento (quando aberto e o mercado tem hora de fechar) */
  nextClose?: Date
}

/**
 * Margem de segurança antes do fechamento. Uma operação precisa de preço real no vencimento;
 * se expirar exatamente na virada, o feed já parou e não há cotação para liquidar.
 */
const CLOSE_BUFFER_SECONDS = 30

/**
 * Forex opera de domingo 21:00 UTC até sexta 21:00 UTC (fecha nos fins de semana).
 * Cripto opera 24/7. OTC está sempre disponível.
 *
 * A referência de horário é UTC para não depender do fuso do dispositivo.
 */
export function getMarketStatus(
  asset: { market?: string; category?: string } | undefined,
  now: Date = new Date(),
): MarketStatus {
  // Sem info do ativo ou ativo OTC: sempre disponível.
  if (!asset || asset.market !== "open") return { open: true }

  // Mercado aberto de cripto funciona 24 horas, todos os dias.
  if (asset.category === "crypto") return { open: true }

  // Demais (forex / ações do mercado aberto): respeita a janela do forex.
  const day = now.getUTCDay() // 0 = domingo ... 6 = sábado
  const hour = now.getUTCHours()

  const isClosed =
    day === 6 || // sábado inteiro
    (day === 5 && hour >= 21) || // sexta a partir das 21:00 UTC
    (day === 0 && hour < 21) // domingo antes das 21:00 UTC

  if (!isClosed) return { open: true, nextClose: getNextForexClose(now) }

  return {
    open: false,
    reason: "Mercado fechado (fim de semana)",
    nextOpen: getNextForexOpen(now),
  }
}

/** Calcula o próximo fechamento do forex: sexta 21:00 UTC. */
function getNextForexClose(now: Date): Date {
  const d = new Date(now)
  while (d.getUTCDay() !== 5) {
    d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCHours(0, 0, 0, 0)
  }
  d.setUTCHours(21, 0, 0, 0)
  // Se já passou das 21:00 desta sexta, o fechamento relevante é o da semana seguinte.
  if (d.getTime() <= now.getTime()) {
    d.setUTCDate(d.getUTCDate() + 7)
    d.setUTCHours(21, 0, 0, 0)
  }
  return d
}

export interface TradeWindowCheck {
  /** true = a entrada pode ser aberta */
  allowed: boolean
  /** motivo curto quando bloqueada (para exibir na UI) */
  reason?: string
}

/**
 * Verifica se uma entrada pode ser aberta agora, considerando a duração escolhida.
 *
 * Bloqueia em dois casos: mercado já fechado, ou mercado aberto mas a operação venceria
 * depois do fechamento — situação em que não existiria preço real para liquidar.
 */
export function canOpenTrade(
  asset: { market?: string; category?: string } | undefined,
  durationSeconds: number,
  now: Date = new Date(),
): TradeWindowCheck {
  const status = getMarketStatus(asset, now)
  if (!status.open) {
    return { allowed: false, reason: status.reason || "Mercado fechado" }
  }

  if (status.nextClose) {
    const expiresAt = now.getTime() + durationSeconds * 1000
    const limit = status.nextClose.getTime() - CLOSE_BUFFER_SECONDS * 1000
    if (expiresAt > limit) {
      return { allowed: false, reason: "Mercado fechando: a operação venceria após o fechamento" }
    }
  }

  return { allowed: true }
}

/** Calcula a próxima abertura do forex: domingo 21:00 UTC. */
function getNextForexOpen(now: Date): Date {
  const d = new Date(now)
  // Avança dia a dia até o próximo domingo.
  while (d.getUTCDay() !== 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCHours(0, 0, 0, 0)
  }
  d.setUTCHours(21, 0, 0, 0)
  // Se já for domingo depois das 21:00, o mercado já estaria aberto — protege o cálculo.
  if (d.getTime() <= now.getTime()) {
    d.setUTCDate(d.getUTCDate() + 7)
    d.setUTCHours(21, 0, 0, 0)
  }
  return d
}
