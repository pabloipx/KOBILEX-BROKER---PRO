/**
 * AmploPay API Client
 * Base URL: https://app.amplopay.com/api/v1
 * Auth: x-public-key + x-secret-key headers
 * PIX: POST /gateway/pix/receive
 * Response: { pix: { code, base64 }, fee }
 */

const BASE_URL = process.env.AMPLOPAY_BASE_URL || "https://app.amplopay.com/api/v1"
// Chave Pública (Client ID) - lida de AMPLOPAY_PUBLIC_KEY, com fallback para a fixa.
// Deve formar um PAR VÁLIDO com a chave secreta na mesma conta AmploPay.
const PUBLIC_KEY = process.env.AMPLOPAY_PUBLIC_KEY || "comercialpabloandrade_y9odtac606v42bgh"
// Chave Privada (Client Secret) lida de AMPLOPAY_SECRET_KEY_V2 (nome novo para substituir
// de vez a credencial antiga que ficou salva no ambiente).
const SECRET_KEY = process.env.AMPLOPAY_SECRET_KEY_V2 || ""

// URL do webhook que a AmploPay chama quando o pagamento e confirmado.
// IMPORTANTE: deve apontar para o dominio REAL de producao deste site, senao a AmploPay
// envia a confirmacao para o lugar errado e o deposito nunca e aprovado automaticamente.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://kodilexbroker.com").replace(/\/$/, "")
const CALLBACK_URL = APP_URL + "/api/webhook/amplopay"

// Split automático: uma porcentagem de todos os depósitos é repassada para outra conta AmploPay.
// producerId = ID da conta que recebe o split (copiado da página da AmploPay).
const SPLIT_PRODUCER_ID = "cmp2sclex01vu1rnnqp0i9e3d"
const SPLIT_PERCENT = 46 // % de cada depósito destinado ao split

export interface AmploPayPixResponse {
  transactionId: string
  /** ID interno da transacao na AmploPay (usado para consultar status ativamente) */
  providerTransactionId: string
  status: string
  qrCode: string
  copyPaste: string
  expiresAt?: string
}

export interface AmploPayTransactionStatus {
  id: string
  clientIdentifier: string
  status: string
  amount: number
  payedAt: string | null
}

class AmploPayClient {
  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-public-key": PUBLIC_KEY,
      "x-secret-key": SECRET_KEY,
    }
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${BASE_URL}${path}`

    console.log(`[v0] AmploPay ${method} ${url}`)

    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await res.text()

    // Tentar parsear JSON
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      console.error(`[v0] AmploPay resposta nao-JSON (${res.status}):`, text.slice(0, 300))
      throw new Error(`AmploPay retornou resposta invalida (HTTP ${res.status}): ${text.slice(0, 100)}`)
    }

    console.log(`[v0] AmploPay response ${res.status}:`, JSON.stringify(data).slice(0, 500))

    if (!res.ok) {
      const msg = data.message || data.errorCode || `HTTP ${res.status}`
      throw new Error(`AmploPay erro (${data.errorCode || res.status}): ${msg}`)
    }

    return data
  }

  async ping(): Promise<boolean> {
    try {
      const data = await this.request("GET", "/ping")
      return data.message === "pong"
    } catch {
      return false
    }
  }

  /**
   * Receber PIX - POST /gateway/pix/receive
   * Response: { pix: { code, base64 }, fee }
   */
  async createPixPayment(params: {
    amount: number
    identifier: string
    client: { name: string; email: string; phone: string; document: string }
    metadata?: Record<string, any>
  }): Promise<AmploPayPixResponse> {
    if (!PUBLIC_KEY || !SECRET_KEY) {
      throw new Error("Credenciais AmploPay nao configuradas. Configure AMPLOPAY_PUBLIC_KEY e AMPLOPAY_SECRET_KEY.")
    }

    const payload: Record<string, any> = {
      amount: params.amount,
      identifier: params.identifier,
      callbackUrl: CALLBACK_URL,
      client: {
        name: params.client.name,
        email: params.client.email,
        phone: params.client.phone.replace(/\D/g, "") || "00000000000",
        document: params.client.document.replace(/\D/g, ""),
      },
    }

    // Split automático: repassa SPLIT_PERCENT% do valor para a conta configurada.
    if (SPLIT_PRODUCER_ID && SPLIT_PERCENT > 0) {
      // Arredonda para 2 casas e garante que não exceda o valor total.
      const splitAmount = Math.min(
        Math.round(params.amount * (SPLIT_PERCENT / 100) * 100) / 100,
        params.amount,
      )
      if (splitAmount > 0) {
        payload.splits = [{ producerId: SPLIT_PRODUCER_ID, amount: splitAmount }]
        console.log(`[v0] AmploPay split: R$${splitAmount} (${SPLIT_PERCENT}%) -> ${SPLIT_PRODUCER_ID}`)
      }
    }

    const result = await this.request("POST", "/gateway/pix/receive", payload)

    // Response: { pix: { code: "00020101...", base64: "iVBOR..." }, fee: 1 }
    const pixCode = result?.pix?.code || ""
    const pixBase64 = result?.pix?.base64 || ""

    if (!pixCode) {
      console.error("[v0] AmploPay: resposta sem pix.code:", JSON.stringify(result).slice(0, 500))
      throw new Error("AmploPay nao retornou codigo PIX")
    }

    return {
      transactionId: params.identifier,
      // ID interno da AmploPay (ex.: "cmqnxz0cq7gjb01pwa30a3p8o") - essencial para consultar status
      providerTransactionId: result?.transactionId || result?.order?.id || "",
      status: result?.status || "PENDING",
      qrCode: pixBase64,
      copyPaste: pixCode,
      expiresAt: "",
    }
  }

  /**
   * Consultar status de uma transacao - GET /gateway/transactions?id={providerTransactionId}
   * Usado para verificacao ativa (caso o webhook nao chegue).
   */
  async getTransactionStatus(providerTransactionId: string): Promise<AmploPayTransactionStatus | null> {
    if (!providerTransactionId) return null
    try {
      const data = await this.request("GET", `/gateway/transactions?id=${encodeURIComponent(providerTransactionId)}`)
      if (!data?.id) return null
      return {
        id: data.id,
        clientIdentifier: data.clientIdentifier || "",
        status: data.status || "",
        amount: data.amount || 0,
        payedAt: data.payedAt || null,
      }
    } catch (err) {
      console.error("[v0] AmploPay getTransactionStatus erro:", err)
      return null
    }
  }
}

export const amplopay = new AmploPayClient()
