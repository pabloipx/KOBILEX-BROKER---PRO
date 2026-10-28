/**
 * Expiracao em horario fixo de relogio (estilo IQ Option).
 *
 * A entrada nao dura "N segundos a partir do clique": ela vence sempre num minuto cheio. A compra
 * para aquele minuto fica liberada ate 30s antes dele — depois disso o alvo pula para o minuto
 * seguinte. E isso que faz o cronometro "HORA DE COMPRA" contar ate 00:00 e reiniciar em ~01:00.
 */
export const PURCHASE_CUTOFF_MS = 30_000

/** Primeiro minuto cheio que ainda aceita compra. */
export function expiryBaseMs(now: number) {
  return Math.ceil((now + PURCHASE_CUTOFF_MS) / 60_000) * 60_000
}

/** Horario (ms) em que uma entrada aberta agora vence, para a duracao nominal escolhida. */
export function expiryAtFor(now: number, nominalSeconds: number) {
  return expiryBaseMs(now) + Math.max(0, nominalSeconds - 60) * 1000
}

/** Ultimo instante (ms) em que ainda da para comprar no alvo atual. */
export function purchaseDeadlineMs(now: number) {
  return expiryBaseMs(now) - PURCHASE_CUTOFF_MS
}
