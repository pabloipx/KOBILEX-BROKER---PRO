// Configuração centralizada com fallbacks seguros para Vercel Serverless
// Nenhuma variável de ambiente é obrigatória - tudo tem fallback

export const config = {
  // Supabase - fallback para strings vazias (não vai conectar, mas não vai crashar)
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    get isConfigured() {
      return !!(this.url && this.anonKey)
    },
    get isAdminConfigured() {
      return !!(this.url && this.serviceRoleKey)
    },
  },

  // AmploPay
  // As DUAS credenciais vem do ambiente e devem ser do MESMO par/conta:
  //   AMPLOPAY_PUBLIC_KEY     -> Chave Pública (Client ID)
  //   AMPLOPAY_SECRET_KEY_V2  -> Chave Privada (Client Secret)
  //
  // A chave publica fixa que existia aqui foi removida. Alem de ser credencial no fonte, ela
  // quebrava o isConfigured abaixo: como publicKey nunca ficava vazia, a checagem passava mesmo
  // com a conta errada configurada, e so a secreta era de fato verificada.
  amplopay: {
    baseUrl: process.env.AMPLOPAY_BASE_URL || "https://app.amplopay.com/api/v1",
    publicKey: process.env.AMPLOPAY_PUBLIC_KEY || "",
    secretKey: process.env.AMPLOPAY_SECRET_KEY_V2 || "",
    get isConfigured() {
      return !!(this.publicKey && this.secretKey)
    },
  },

  // Admin
  admin: {
    token: process.env.ADMIN_TOKEN || "Admin123!",
  },

  // App
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    isDev: process.env.NODE_ENV === "development",
    isProd: process.env.NODE_ENV === "production",
  },
}

// Helper para verificar se o ambiente está configurado
export function isEnvironmentReady(): boolean {
  return config.supabase.isConfigured
}

// Helper para criar resposta de erro controlada
export function createErrorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// Helper para criar resposta de sucesso
export function createSuccessResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify({ ...data, success: true }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
