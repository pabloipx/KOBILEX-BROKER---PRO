/**
 * Gravacao de saldo pelo admin.
 *
 * PROBLEMA QUE ISTO RESOLVE: os handlers do admin montavam o registro assim:
 *
 *   balance_real: Number(balanceReal) || 0,
 *   balance_demo: Number(balanceDemo) || 0,
 *
 * Quando o formulario enviava apenas um dos saldos, o outro chegava como `undefined`,
 * `Number(undefined)` da `NaN`, e o `|| 0` transformava isso em ZERO. Resultado: alterar o saldo
 * real ZERAVA o saldo demo (e vice-versa) no banco. A tela ainda mostrava o valor antigo em
 * memoria, mas ao atualizar a pagina os dados vinham do banco e o saldo "sumia" — era esse o bug.
 *
 * A regra correta e: campo nao enviado = campo nao alterado. Nunca inferir zero de uma ausencia.
 */

/**
 * Converte o valor recebido do formulario em um numero de dinheiro valido.
 * Retorna `null` quando o campo NAO deve ser gravado (ausente, vazio ou invalido) — o que e
 * diferente de gravar 0. Aceita "1.234,56" e "1234.56", formatos que o admin pode digitar.
 */
function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null) return null

  let raw = value
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (trimmed === "") return null
    // Formato brasileiro: remove separador de milhar e usa ponto como decimal.
    raw = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed
  }

  const n = Number(raw)
  // NaN, Infinity e negativo nao viram 0: sao recusados, para nao corromper o saldo.
  if (!Number.isFinite(n) || n < 0) return null

  return Math.round(n * 100) / 100
}

/**
 * Monta o registro para o upsert em `user_balances` contendo SOMENTE os saldos realmente enviados.
 * Como o upsert atualiza apenas as colunas presentes no objeto, o saldo nao informado permanece
 * intacto no banco. Retorna `null` quando nenhum saldo valido foi enviado (nada a gravar).
 */
export function buildBalanceUpsert(
  userId: string,
  balanceReal: unknown,
  balanceDemo: unknown,
): Record<string, unknown> | null {
  const real = parseAmount(balanceReal)
  const demo = parseAmount(balanceDemo)

  if (real === null && demo === null) return null

  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  }
  if (real !== null) row.balance_real = real
  if (demo !== null) row.balance_demo = demo

  return row
}
