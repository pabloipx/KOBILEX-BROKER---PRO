export type LiveTradeInput = {
  direction: "CALL" | "PUT"
  amount: number
  entryPrice: number
  timestamp: number
  /** Duracao real da entrada, em segundos. */
  expiryTime: number
}

export type LiveTradeState = {
  inMoney: boolean
  /** Resultado se a operacao vencer agora (lucro esperado ou perda total). */
  expectedPnl: number
  /** Valor creditado se o usuario vender agora. */
  sellValue: number
  /** Lucro/prejuizo ao vender agora. */
  sellPnl: number
  sellPct: number
  remainingMs: number
}

// Margem retida pela corretora na venda antecipada.
const SELL_SPREAD = 0.97

/**
 * Estimativa do valor de venda antecipada: probabilidade de terminar no dinheiro, que cresce com
 * a distancia do preco ate a entrada e com o tempo ja decorrido, aplicada ao retorno total.
 */
export function liveTradeState(trade: LiveTradeInput, price: number, payoutPct: number, now = Date.now()): LiveTradeState {
  const totalMs = Math.max(1, trade.expiryTime * 1000)
  const remainingMs = Math.max(0, trade.timestamp + totalMs - now)
  const elapsed = Math.min(1, Math.max(0, 1 - remainingMs / totalMs))

  const isCall = trade.direction === "CALL"
  const diff = price - trade.entryPrice
  const inMoney = isCall ? diff > 0 : diff < 0
  const payout = payoutPct / 100

  const distance = trade.entryPrice > 0 ? Math.abs(diff) / trade.entryPrice : 0
  const strength = Math.min(1, distance * 2500)
  const confidence = Math.min(1, strength * (0.35 + 0.65 * elapsed) + elapsed * 0.25)
  const sign = diff === 0 ? 0 : inMoney ? 1 : -1
  const pWin = Math.min(0.98, Math.max(0.02, 0.5 + sign * 0.5 * confidence))

  const maxReturn = trade.amount * (1 + payout)
  const sellValue = Math.round(Math.min(maxReturn, maxReturn * pWin * SELL_SPREAD) * 100) / 100
  const sellPnl = Math.round((sellValue - trade.amount) * 100) / 100

  return {
    inMoney,
    expectedPnl: inMoney ? Math.round(trade.amount * payout * 100) / 100 : -trade.amount,
    sellValue,
    sellPnl,
    sellPct: trade.amount > 0 ? (sellPnl / trade.amount) * 100 : 0,
    remainingMs,
  }
}

export const fmtBRL = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtSigned = (v: number) => `${v >= 0 ? "+" : "−"}R$ ${fmtBRL(Math.abs(v))}`
