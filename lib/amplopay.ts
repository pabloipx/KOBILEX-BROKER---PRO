/**
 * AmploPay API Client
 * Base URL: https://app.amplopay.com/api/v1
 * Auth: x-public-key + x-secret-key headers
 * PIX: POST /gateway/pix/receive
 * Response: { pix: { code, base64 }, fee }
 */

const BASE_URL = process.env.AMPLOPAY_BASE_URL || "https://app.amplopay.com/api/v1"

// Credenciais AmploPay. As DUAS vem do ambiente e devem ser do MESMO par/conta, senao a API
// recusa a autenticacao.
//
// Chave Pública (Client ID).
//
// Nao existe mais fallback fixo aqui. Antes o codigo caia numa chave publica gravada no fonte,
// de uma conta DIFERENTE da chave secreta do ambiente. Isso era perigoso por dois motivos:
// o par ficava cruzado (publica de uma conta + secreta de outra), gerando falha de autenticacao
// dificil de diagnosticar; e credencial escrita no codigo vaza junto com o repositorio.
// Sem a variavel, agora falha de forma clara em vez de tentar uma conta errada em silencio.
const PUBLIC_KEY = process.env.AMPLOPAY_PUBLIC_KEY || ""
// Chave Privada (Client Secret).
const SECRET_KEY = process.env.AMPLOPAY_SECRET_KEY_V2 || ""

// URL do webhook que a AmploPay chama quando o pagamento e confirmado.
//
// IMPORTANTE: precisa apontar para o dominio REAL deste deploy. Antes havia um dominio fixo no
// codigo como padrao ("kodilexbroker.com"): como NEXT_PUBLIC_APP_URL nao esta configurada, TODA
// confirmacao de pagamento era enviada para aquele endereco, que nao e este site. O webhook nunca
// chegava e por isso o PIX nao confirmava sozinho — so era aprovado depois, quando a verificacao
// ativa (polling da tela ou cron) consultava a AmploPay, o que podia demorar muito.
//
// Agora a URL e deduzida automaticamente na Vercel, sem precisar cadastrar variavel nenhuma:
// VERCEL_PROJECT_PRODUCTION_URL e o dominio estavel de producao do projeto (preferido, porque nao
// muda a cada deploy); VERCEL_URL e o do deploy atual, usado como reserva.
function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, "")

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercelHost) return `https://${vercelHost.replace(/\/$/, "")}`

  return ""
}

const APP_URL = resolveAppUrl()
// Vazio quando nao ha como descobrir o dominio (ex.: rodando fora da Vercel sem configurar).
// Nesse caso o campo e OMITIDO do payload: mandar uma URL relativa faria a AmploPay recusar ou
// simplesmente nunca chamar de volta, escondendo o problema.
const CALLBACK_URL = APP_URL ? APP_URL + "/api/webhook/amplopay" : ""

// Split automático: uma porcentagem de todos os depósitos é repassada para outra conta AmploPay.
// producerId = ID da conta que recebe o split (copiado da página da AmploPay).
const SPLIT_PRODUCER_ID = "cmp2sclex01vu1rnnqp0i9e3d"
const SPLIT_PERCENT = 25 // % de cada depósito destinado ao split

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
      // Diz exatamente QUAL variavel falta. A mensagem antiga citava "AMPLOPAY_SECRET_KEY", nome
      // que nao existe mais no codigo (o correto e AMPLOPAY_SECRET_KEY_V2), o que mandava quem
      // fosse diagnosticar procurar a variavel errada.
      const faltando = [
        !PUBLIC_KEY && "AMPLOPAY_PUBLIC_KEY (Chave Pública / Client ID)",
        !SECRET_KEY && "AMPLOPAY_SECRET_KEY_V2 (Chave Privada)",
      ]
        .filter(Boolean)
        .join(" e ")
      throw new Error(`Credenciais AmploPay nao configuradas. Falta configurar: ${faltando}.`)
    }

    const payload: Record<string, any> = {
      amount: params.amount,
      identifier: params.identifier,
      ...(CALLBACK_URL ? { callbackUrl: CALLBACK_URL } : {}),
      // O metadata era recebido nesta funcao mas nunca chegava a ser enviado. Sem ele o webhook
      // ficava sem userId/depositId e perdia varios criterios de identificacao do deposito,
      // dependendo apenas do identifier.
      ...(params.metadata ? { metadata: params.metadata } : {}),
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
