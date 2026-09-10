"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { LiveCandles } from "@/components/iabroker/live-candles"
import {
  Bot,
  ShieldCheck,
  Lock,
  Mail,
  Loader2,
  Check,
  ArrowLeft,
  Zap,
  TrendingUp,
  Activity,
  Wallet,
  Pause,
  Play,
  Power,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Cpu,
  AlertTriangle,
} from "lucide-react"

type Step = "connect" | "connecting" | "plans" | "active"

type Plan = {
  id: string
  amount: number
  daily: number
}

const PLANS: Plan[] = [
  { id: "start", amount: 500, daily: 5 },
  { id: "pro", amount: 1000, daily: 7 },
  { id: "elite", amount: 5000, daily: 9 },
]

const CONNECT_STAGES = [
  { label: "Autenticando credenciais na corretora", detail: "Validando sessão segura" },
  { label: "Conectando ao motor Anthropic Claude", detail: "Estabelecendo túnel criptografado" },
  { label: "Carregando dados do gráfico em tempo real", detail: "EUR/USD · GBP/USD · BTC/USD · XAU/USD" },
  { label: "Executando análise de padrões", detail: "Processando 2.400+ candles históricos" },
  { label: "Calibrando modelo preditivo", detail: "Ajustando pesos da rede neural" },
  { label: "Validando pontos de entrada", detail: "Cruzando indicadores e volume" },
  { label: "IA pronta para operar", detail: "Estratégia otimizada e ativa" },
]

const ASSETS = ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD", "USD/JPY", "ETH/USD"]

type Entry = {
  id: number
  dir: "BUY" | "SELL"
  asset: string
  result: "win" | "loss"
  pnl: number
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function IaBrokerPage() {
  const [step, setStep] = useState<Step>("connect")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [balance, setBalance] = useState(0)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    const pass = password.trim()
    if (!mail || !pass) {
      setError("Preencha e-mail e senha da corretora")
      return
    }

    setError(null)
    setStageIndex(0)
    setStep("connecting")

    try {
      const supabase = createClient()
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: mail,
        password: pass,
      })
      if (signInError) {
        const msg = signInError.message.toLowerCase()
        if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
          throw new Error("E-mail ou senha da corretora incorretos")
        }
        if (msg.includes("too many requests")) {
          throw new Error("Muitas tentativas. Aguarde alguns minutos.")
        }
        throw new Error(signInError.message)
      }

      // Carregar saldo real da carteira do usuário
      const userId = authData.user?.id
      if (userId) {
        const { data: balanceData } = await supabase
          .from("user_balances")
          .select("balance_real")
          .eq("user_id", userId)
          .single()
        if (mounted.current) setBalance(balanceData?.balance_real || 0)
      }
    } catch (err) {
      if (!mounted.current) return
      setStep("connect")
      setError(err instanceof Error ? err.message : "Falha ao conectar com a corretora")
      return
    }

    // Sequência visual de conexão com Anthropic e análise do gráfico (~15s total)
    const perStage = 15000 / CONNECT_STAGES.length
    for (let i = 0; i < CONNECT_STAGES.length; i++) {
      if (!mounted.current) return
      setStageIndex(i)
      await sleep(perStage)
    }
    if (!mounted.current) return
    setStep("plans")
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <Link href="/trade" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Voltar</span>
        </Link>
        <Image
          src="/images/uryn-fox-logo.png"
          alt="URYNBROKER"
          width={140}
          height={34}
          className="h-8 w-auto"
          unoptimized
        />
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          IA
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-6 sm:py-10">
        {step === "connect" && (
          <ConnectForm
            email={email}
            password={password}
            error={error}
            onEmail={setEmail}
            onPassword={setPassword}
            onSubmit={handleConnect}
          />
        )}

        {step === "connecting" && <Connecting stageIndex={stageIndex} />}

        {step === "plans" && (
          <Plans
            balance={balance}
            onSelect={(p) => {
              setPlan(p)
              setStep("active")
            }}
          />
        )}

        {step === "active" && plan && (
          <ActivePanel plan={plan} balance={balance} onStop={() => setStep("plans")} />
        )}
      </main>
    </div>
  )
}

/* ---------------- Etapa 1: Conexão ---------------- */

function ConnectForm({
  email,
  password,
  error,
  onEmail,
  onPassword,
  onSubmit,
}: {
  email: string
  password: string
  error: string | null
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  const inputClass =
    "w-full h-12 pl-11 pr-4 rounded-xl bg-black/40 text-foreground text-[15px] border border-white/10 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"

  return (
    <div className="w-full max-w-md animate-fade-up">
      {/* Terminal de mercado com candles ao vivo ao fundo */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0e1420] to-[#0a0d14] shadow-2xl shadow-black/50">
        {/* fundo de candles */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
          <LiveCandles active />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0d14]/60 to-[#0a0d14]" />
        {/* grade sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Ticker de cotações ao vivo */}
        <MarketTicker />

        <div className="relative px-5 py-7 sm:px-7 sm:py-8">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-hero-pulse" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-atlas-orange-dark shadow-lg shadow-primary/40 ring-1 ring-white/20">
                <Bot className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-atlas-success/30 bg-atlas-success/10 px-2.5 py-1 mb-3">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-atlas-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-atlas-success" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-atlas-success">
                Mercado ao vivo
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-balance">Robô de IA URYN</h1>
            <p className="text-muted-foreground text-sm mt-2 text-pretty max-w-xs">
              A inteligência artificial que analisa o mercado e faz entradas no gráfico por você.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <Lock className="w-4 h-4 text-primary" />
              Conecte sua conta da corretora para liberar a IA
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="E-mail da corretora"
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Senha da corretora"
                  value={password}
                  onChange={(e) => onPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="text-sm p-3 rounded-lg flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/30">
                  <span>⚠</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="group relative w-full h-13 py-3.5 rounded-xl text-primary-foreground font-semibold text-base bg-gradient-to-r from-primary to-atlas-orange-dark hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
              >
                <Zap className="w-5 h-5" />
                Conectar com a corretora
              </button>
            </form>

            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-atlas-success" />
              Conexão criptografada. Seus dados não são compartilhados.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Ticker de cotações ao vivo no topo do terminal */
function MarketTicker() {
  const [ticks, setTicks] = useState(() =>
    [
      { s: "EUR/USD", p: 1.0847 },
      { s: "GBP/USD", p: 1.2634 },
      { s: "BTC/USD", p: 64231 },
      { s: "XAU/USD", p: 2338.5 },
      { s: "USD/JPY", p: 156.82 },
      { s: "ETH/USD", p: 3145.2 },
    ].map((t) => ({ ...t, d: 0 })),
  )

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) =>
        prev.map((t) => {
          const delta = (Math.random() - 0.5) * (t.p > 1000 ? t.p * 0.0006 : t.p * 0.0004)
          return { ...t, p: t.p + delta, d: delta }
        }),
      )
    }, 1400)
    return () => clearInterval(id)
  }, [])

  const fmt = (p: number) => (p > 1000 ? p.toFixed(0) : p.toFixed(p > 100 ? 2 : 4))

  return (
    <div className="relative flex items-center gap-4 overflow-hidden border-b border-white/10 bg-black/40 px-4 py-2 backdrop-blur-sm">
      <div className="flex animate-marquee items-center gap-5 whitespace-nowrap">
        {[...ticks, ...ticks].map((t, i) => {
          const up = t.d >= 0
          return (
            <span key={i} className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">{t.s}</span>
              <span className="font-mono text-foreground">{fmt(t.p)}</span>
              <span className={up ? "text-atlas-success" : "text-destructive"}>
                {up ? "▲" : "▼"}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Etapa 2: Conectando ---------------- */

function Connecting({ stageIndex }: { stageIndex: number }) {
  const progress = ((stageIndex + 1) / CONNECT_STAGES.length) * 100
  return (
    <div className="w-full max-w-md flex flex-col items-center pt-4 animate-fade-up">
      <div className="relative mb-7 flex items-center justify-center">
        <div className="absolute h-40 w-40 rounded-full border border-primary/30 animate-result-ring" />
        <div
          className="absolute h-52 w-52 rounded-full border border-primary/15 animate-result-ring"
          style={{ animationDelay: "0.6s" }}
        />
        <div className="absolute h-40 w-40 rounded-full bg-primary/10 blur-2xl animate-hero-pulse" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-atlas-orange-dark shadow-lg shadow-primary/40">
          <Bot className="w-10 h-10 text-primary-foreground" />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground mb-3">
        <Cpu className="w-3.5 h-3.5 text-primary" />
        Powered by Anthropic Claude
      </div>
      <h2 className="text-xl font-bold mb-1 text-center text-balance">Ativando a inteligência artificial</h2>
      <p className="text-muted-foreground text-sm mb-6 text-center">
        A IA está lendo o gráfico e montando a estratégia
      </p>

      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-atlas-orange-hover transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="w-full flex justify-between text-[11px] text-muted-foreground mb-6">
        <span>Analisando mercado</span>
        <span>{Math.round(progress)}%</span>
      </div>

      <div className="w-full flex flex-col gap-2.5">
        {CONNECT_STAGES.map((stage, i) => {
          const done = i < stageIndex
          const current = i === stageIndex
          return (
            <div
              key={stage.label}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${
                current
                  ? "border-primary/50 bg-primary/5"
                  : done
                    ? "border-border bg-card"
                    : "border-border bg-card opacity-45"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-atlas-success" : current ? "bg-primary" : "bg-secondary"
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : current ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className={`text-sm ${current || done ? "text-foreground" : "text-muted-foreground"}`}>
                  {stage.label}
                </div>
                {current && (
                  <div className="text-[11px] text-primary/80 mt-0.5 animate-fade-up">{stage.detail}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Etapa 3: Planos ---------------- */

function Plans({ balance, onSelect }: { balance: number; onSelect: (p: Plan) => void }) {
  const affordablePlans = PLANS.filter((p) => balance >= p.amount)
  const defaultId = affordablePlans.length ? affordablePlans[affordablePlans.length - 1].id : PLANS[0].id
  const [selected, setSelected] = useState<string>(defaultId)
  const chosen = PLANS.find((p) => p.id === selected)!
  const canAfford = balance >= chosen.amount
  const cheapest = PLANS[0].amount
  const missing = Math.max(0, chosen.amount - balance)

  return (
    <div className="w-full max-w-3xl animate-fade-up">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-atlas-success/10 border border-atlas-success/30 px-3 py-1 text-xs font-medium text-atlas-success mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-atlas-success animate-pulse" />
          Conta conectada com sucesso
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-balance">Escolha o rendimento da IA</h1>
        <p className="text-muted-foreground text-sm mt-2 text-pretty max-w-md">
          Defina quanto deseja alocar para a IA operar sozinha. Quanto maior o valor, maior o rendimento diário.
        </p>
      </div>

      {/* Carteira do usuário */}
      <div className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 border border-primary/30">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Saldo da sua carteira</div>
            <div className="text-2xl font-bold">{brl(balance)}</div>
          </div>
        </div>
        <div
          className={`text-xs font-medium px-3 py-1.5 rounded-full ${
            balance >= cheapest
              ? "bg-atlas-success/15 text-atlas-success"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {balance >= cheapest ? "Saldo disponível" : "Saldo insuficiente"}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => {
          const isSel = p.id === selected
          const highlight = p.id === "pro"
          const locked = balance < p.amount
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`relative text-left rounded-2xl border p-5 transition-all ${
                isSel
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/40"
              } ${locked ? "opacity-60" : ""}`}
            >
              {highlight && !locked && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  Mais popular
                </span>
              )}
              {locked && (
                <span className="absolute -top-2.5 left-5 flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  <Lock className="w-2.5 h-2.5" />
                  Sem saldo
                </span>
              )}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Investimento</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    isSel ? "border-primary bg-primary" : "border-border"
                  }`}
                >
                  {isSel && <Check className="w-3 h-3 text-primary-foreground" />}
                </span>
              </div>
              <div className="text-3xl font-bold mb-3">{brl(p.amount)}</div>
              <div className="flex items-baseline gap-1.5">
                <TrendingUp className="w-4 h-4 text-atlas-success" />
                <span className="text-atlas-success font-semibold">{p.daily}% ao dia</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                ≈ {brl((p.amount * p.daily) / 100)} por dia
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <div className="text-sm text-muted-foreground">Projeção com {brl(chosen.amount)}</div>
          <div className="text-lg font-semibold">
            {brl((chosen.amount * chosen.daily) / 100)} / dia
            <span className="text-muted-foreground font-normal text-sm">
              {" "}
              · {brl(((chosen.amount * chosen.daily) / 100) * 30)} / mês
            </span>
          </div>
        </div>
        {canAfford ? (
          <button
            onClick={() => onSelect(chosen)}
            className="w-full sm:w-auto px-8 h-13 py-3.5 rounded-xl text-primary-foreground font-semibold bg-primary hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
          >
            <Power className="w-5 h-5" />
            Ativar IA
          </button>
        ) : (
          <Link
            href="/deposit"
            className="w-full sm:w-auto px-8 h-13 py-3.5 rounded-xl text-primary-foreground font-semibold bg-primary hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            Depositar {brl(missing)}
          </Link>
        )}
      </div>

      {!canAfford && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4" />
          Você precisa de {brl(missing)} a mais para ativar este plano.
        </div>
      )}
    </div>
  )
}

/* ---------------- Etapa 4: IA operando ---------------- */

function ActivePanel({ plan, balance, onStop }: { plan: Plan; balance: number; onStop: () => void }) {
  const dailyTarget = (plan.amount * plan.daily) / 100
  const [running, setRunning] = useState(true)
  const [profit, setProfit] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [entries, setEntries] = useState<Entry[]>([])
  const [count, setCount] = useState(0)
  const idRef = useRef(0)

  useEffect(() => {
    if (!running) return
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false

    const runEntry = () => {
      idRef.current += 1
      const win = Math.random() < 0.72
      const dir: Entry["dir"] = Math.random() < 0.5 ? "BUY" : "SELL"
      const asset = ASSETS[Math.floor(Math.random() * ASSETS.length)]
      const base = plan.amount * 0.02
      const pnl = win ? base * (0.85 + Math.random() * 0.15) : -base * (0.5 + Math.random() * 0.3)
      const entry: Entry = { id: idRef.current, dir, asset, result: win ? "win" : "loss", pnl }
      setEntries((prev) => [entry, ...prev].slice(0, 8))
      setCount((c) => c + 1)
      setProfit((p) => Math.min(dailyTarget, Math.max(0, p + pnl)))
      setTotalEarned((t) => Math.max(0, t + pnl))
      schedule()
    }

    const schedule = () => {
      if (cancelled) return
      // Entrada a cada 20–40s: a IA aguarda a melhor oportunidade, sem operar toda hora
      const delay = 20000 + Math.random() * 20000
      timer = setTimeout(runEntry, delay)
    }

    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [running, plan.amount, dailyTarget])

  const progress = Math.min(100, (profit / dailyTarget) * 100)

  return (
    <div className="w-full max-w-4xl animate-fade-up">
      {/* Barra de status */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-atlas-orange-dark">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            {running && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-atlas-success opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-atlas-success" />
              </span>
            )}
          </div>
          <div>
            <div className="font-semibold flex items-center gap-2">
              IA URYN
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  running ? "bg-atlas-success/15 text-atlas-success" : "bg-secondary text-muted-foreground"
                }`}
              >
                {running ? "Operando" : "Pausada"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Plano {brl(plan.amount)} · {plan.daily}% ao dia
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="h-10 px-4 rounded-xl border border-border bg-secondary hover:bg-accent transition-colors flex items-center gap-2 text-sm font-medium"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? "Pausar" : "Retomar"}
          </button>
          <button
            onClick={onStop}
            className="h-10 px-4 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Power className="w-4 h-4" />
            Desativar
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard icon={<Wallet className="w-4 h-4 text-primary" />} label="Saldo na carteira" value={brl(balance)} />
        <StatCard icon={<Zap className="w-4 h-4" />} label="Investido" value={brl(plan.amount)} />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-atlas-success" />}
          label="Lucro hoje"
          value={brl(profit)}
          accent
        />
        <StatCard icon={<Zap className="w-4 h-4 text-primary" />} label="Meta diária" value={brl(dailyTarget)} />
        <StatCard icon={<Activity className="w-4 h-4" />} label="Entradas" value={String(count)} />
      </div>

      {/* Rendimento já gerado pela IA */}
      <div className="rounded-2xl border border-atlas-success/30 bg-gradient-to-br from-atlas-success/10 to-transparent p-5 mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <TrendingUp className="w-4 h-4 text-atlas-success" />
              Rendimento já gerado pela IA
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-atlas-success">{brl(totalEarned)}</div>
            <div className="text-xs text-muted-foreground mt-1.5">
              Acumulado desde a ativação · {count} {count === 1 ? "entrada" : "entradas"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-1">Retorno sobre o investido</div>
            <div className="text-2xl font-bold">
              {plan.amount > 0 ? ((totalEarned / plan.amount) * 100).toFixed(2) : "0.00"}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Gráfico */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Análise em tempo real
            </div>
            {running && (
              <div className="flex items-center gap-1.5 text-xs text-atlas-success">
                <span className="h-1.5 w-1.5 rounded-full bg-atlas-success animate-pulse" />
                IA analisando padrões
              </div>
            )}
          </div>
          <div className="h-48 sm:h-56">
            <LiveCandles active={running} />
          </div>
          {/* Progresso da meta */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Progresso da meta diária</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-atlas-success transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Feed de entradas */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Entradas da IA
          </div>
          {entries.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-2 text-primary" />
              <span className="text-sm">Procurando a melhor entrada...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((e) => {
                const win = e.result === "win"
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          e.dir === "BUY" ? "bg-atlas-success/15" : "bg-destructive/15"
                        }`}
                      >
                        {e.dir === "BUY" ? (
                          <ArrowUpRight className="w-4 h-4 text-atlas-success" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{e.asset}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {e.dir === "BUY" ? "Compra" : "Venda"}
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${win ? "text-atlas-success" : "text-destructive"}`}>
                      {win ? "+" : ""}
                      {brl(e.pnl)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6 max-w-xl mx-auto text-pretty">
        A IA opera automaticamente com base na análise de mercado. Resultados passados não garantem retornos futuros.
      </p>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${accent ? "text-atlas-success" : ""}`}>{value}</div>
    </div>
  )
}
