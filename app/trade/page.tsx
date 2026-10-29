"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { MarketChart } from "@/components/trading/market-chart"
import { SidebarMenu } from "@/components/trading/sidebar-menu"
import { TraderIAModal } from "@/components/trading/trader-ia-modal"
import { TraderIAWatermark } from "@/components/trading/trader-ia-watermark"
import { KaykoRobot } from "@/components/trading/kayko-robot"
import { AnnouncementPopup } from "@/components/trading/announcement-popup"
import { OLHO_DE_CRONOS } from "@/lib/robots"
import { TradeHistorySidebar } from "@/components/trading/trade-history-sidebar"
import { TradeResultOverlay } from "@/components/trading/trade-result-overlay"
import { AssetPanel } from "@/components/trading/asset-panel"
import { useGlobalOTC } from "@/lib/hooks/use-global-otc"
import { TabTimer } from "@/components/trading/tab-timer"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import { getLivePrice } from "@/lib/price-engine/live-price-store"
import { LivePriceText } from "@/components/trading/live-price-text"
import { playCallSound, playPutSound, playWinSound, playLossSound, unlockAudio } from "@/lib/sounds"
import Image from "next/image"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  MoreVertical,
  Wallet,
  TrendingUp,
  TrendingDown,
  X,
  Search,
  Clock,
  LayoutGrid,
  Lock,
  CircleDollarSign,
} from "lucide-react"
import { TraderoomNav, type NavItemId } from "@/components/trading/traderoom/traderoom-nav"
import { TraderoomSidePanel, type SidePanelId } from "@/components/trading/traderoom/traderoom-side-panel"
import { useNavConfig } from "@/components/trading/traderoom/use-nav-config"
import { usePriceAlerts } from "@/lib/hooks/use-price-alerts"

function playAlertTone() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    osc.onended = () => ctx.close()
  } catch {}
}
import { TraderoomBalanceMenu } from "@/components/trading/traderoom/traderoom-balance-menu"
import { TraderoomTradePanel } from "@/components/trading/traderoom/traderoom-trade-panel"
import { TraderoomChartOverlay } from "@/components/trading/traderoom/traderoom-chart-overlay"
import { TraderoomPortfolio } from "@/components/trading/traderoom/traderoom-portfolio"
import { TraderoomFooter } from "@/components/trading/traderoom/traderoom-footer"
import { TraderoomProfileMenu } from "@/components/trading/traderoom/traderoom-profile-menu"
import { TraderoomTabStatus } from "@/components/trading/traderoom/traderoom-tab-status"
import { TraderoomActiveTradeBar } from "@/components/trading/traderoom/traderoom-active-trade-bar"
import { expiryAtFor } from "@/lib/trading/expiry"
import { liveTradeState } from "@/lib/trading/live-pnl"
import { getMarketStatus, canOpenTrade } from "@/lib/market-hours"
import {
  TIMEFRAME_LABELS,
  timeframesFor,
  normalizeTimeframe,
  isTimeframeAllowed,
  type Timeframe,
} from "@/lib/trading/timeframes"

interface ActiveTrade {
  id: string
  /**
   * Id real da linha em `trades`. Antes a liquidacao nao guardava esse id e precisava
   * "adivinhar" qual linha encerrar buscando a operacao pendente mais recente do ativo.
   * Com duas ou mais operacoes pendentes no mesmo ativo isso escolhia a linha errada.
   */
  dbId?: string
  symbol: string
  direction: "CALL" | "PUT"
  amount: number
  entryPrice: number
  expiryTime: number
  timestamp: number
  isDemo: boolean
}

interface Asset {
  symbol: string
  name: string
  category: string
  payout: number
  logo: string
  market?: "otc" | "open"
}

// Fallback exibido enquanto a lista dinâmica (controlada pelo admin) carrega
const FALLBACK_ASSETS: Asset[] = [
  {
    symbol: "EURUSD_OTC",
    name: "EUR/USD (OTC)",
    category: "forex",
    payout: 96,
    logo: "/images/a1640800-8419-484d-9351.jpeg",
  },
  {
    symbol: "GBPUSD_OTC",
    name: "GBP/USD (OTC)",
    category: "forex",
    payout: 96,
    logo: "/images/5c13c1c5-2d6b-4006-b117.jpeg",
  },
  {
    symbol: "USDJPY_OTC",
    name: "USD/JPY (OTC)",
    category: "forex",
    payout: 96,
    logo: "/images/06fd67b4-821f-4dad-9daf.jpeg",
  },
  {
    symbol: "AUDUSD_OTC",
    name: "AUD/USD (OTC)",
    category: "forex",
    payout: 96,
    logo: "/images/82329959-774d-46ff-b731.jpeg",
  },
  {
    symbol: "BTCUSD_OTC",
    name: "BTC/USD (OTC)",
    category: "crypto",
    payout: 96,
    logo: "/images/a8ba8d63-a559-42c6-955c.jpeg",
  },
]

// As duracoes permitidas dependem do ativo (mercado aberto: 5m/10m/15m; OTC: 1m/5m/10m).
// A regra vive em lib/trading/timeframes para ser a mesma na interface e na API.

const formatCurrency = (value: number | undefined | null): string => {
  const safeValue = typeof value === "number" && !isNaN(value) ? value : 0
  return safeValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatFixed = (value: number | undefined | null, decimals = 2): string => {
  const safeValue = typeof value === "number" && !isNaN(value) ? value : 0
  return safeValue.toFixed(decimals)
}

export default function TradePage() {
  const router = useRouter()
  const mountedRef = useRef(true)
  const supabaseRef = useRef(createClient())

  // Global handler for unhandled promise rejections (AbortError)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === "AbortError" || event.reason?.message?.includes("aborted")) {
        event.preventDefault()
      }
    }
    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection)
  }, [])
  const [user, setUser] = useState<any>(null)
  const [isAffiliate, setIsAffiliate] = useState(false)
  const isAffiliateRef = useRef(false)
  const [balanceReal, setBalanceReal] = useState(0)
  const [balanceDemo, setBalanceDemo] = useState(10000)
  const [loading, setLoading] = useState(true)
  const [selectedSymbol, setSelectedSymbol] = useState("EURUSD_OTC")
  // Abas de ativos abertas (estilo IQ Option). O ativo selecionado e sempre uma delas.
  const [openTabs, setOpenTabs] = useState<string[]>(["EURUSD_OTC"])
  // Dois tempos INDEPENDENTES:
  //  - expiryTime: duracao da ENTRADA (controlado pelas setas "Horario").
  //  - timeframe: periodo do GRAFICO (controlado pelas abas "Tempo do grafico").
  // O usuario pode deixar os dois diferentes de proposito — por exemplo, operar em 1m
  // enquanto observa o grafico em 5m. Por isso sao estados separados e nada os liga.
  const [expiryTime, setExpiryTime] = useState<number>(60)
  const [timeframe, setTimeframe] = useState<number>(60)
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([])
  const [isTrading, setIsTrading] = useState(false)
  const [showSidebar, setSidebarOpen] = useState(false)
  // Fila de animacoes de resultado.
  //
  // Antes isto era um unico estado. Quando duas operacoes eram liquidadas no mesmo ciclo de
  // verificacao (o intervalo roda a cada 500ms), a segunda sobrescrevia a primeira e apenas uma
  // animacao aparecia. Pior: cada liquidacao agendava seu proprio `setTimeout` de 3s para limpar
  // o estado compartilhado, entao o timer da primeira apagava a animacao da segunda no meio.
  // Com uma fila, cada resultado e exibido por inteiro, um apos o outro.
  const [resultQueue, setResultQueue] = useState<Array<{ key: string; type: "win" | "loss"; amount: number }>>([])
  const currentResult = resultQueue[0]

  // Quando ha varios resultados aguardando, encurta a exibicao para a fila nao demorar demais.
  const resultDurationMs = resultQueue.length > 1 ? 1600 : 3000

  // Um unico timer, sempre ligado ao resultado que esta na frente da fila.
  useEffect(() => {
    if (!currentResult) return
    const timer = setTimeout(() => {
      setResultQueue((prev) => prev.slice(1))
    }, resultDurationMs)
    return () => clearTimeout(timer)
  }, [currentResult?.key, resultDurationMs])
  const [tradeError, setTradeError] = useState<string | null>(null)
  // Direcao apenas pre-visualizada: setada no hover de Comprar/Vender para tingir o grafico.
  const [hoverDirection, setHoverDirection] = useState<"call" | "put" | null>(null)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [accountType, setAccountType] = useState<"demo" | "real">("real")
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [amount, setAmount] = useState(10)
  // Modal centralizado: usado somente no mobile.
  const [showAssetModal, setShowAssetModal] = useState(false)
  // Gaveta lateral de ativos: usada somente no desktop (ver components/trading/asset-panel).
  const [showAssetPanel, setShowAssetPanel] = useState(false)
  const [assetSearch, setAssetSearch] = useState("")
  // Aba do modal de ativos: "otc" (sempre aberto) ou "open" (mercado aberto)
  const [assetMarketTab, setAssetMarketTab] = useState<"otc" | "open">("otc")
  const [availableAssets, setAvailableAssets] = useState<Asset[]>(FALLBACK_ASSETS)

  // Carrega os ativos habilitados pelo admin
  useEffect(() => {
    let cancelled = false
    fetch("/api/assets/enabled")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data?.assets) || data.assets.length === 0) return
        setAvailableAssets(data.assets)
        // Se o ativo selecionado foi desativado, volta para o primeiro disponível
        setSelectedSymbol((curr) =>
          data.assets.some((a: Asset) => a.symbol === curr) ? curr : data.assets[0].symbol,
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Trader IA
  const [showTraderIAModal, setTraderIAModalOpen] = useState(false)
  const [isTraderIAActive, setIsTraderIAActive] = useState(false)

  // Robô KAYKO: ativado pelo perfil (senha) e persistido no dispositivo. A tela de trade
  // apenas lê o estado — reage a mudanças em outra aba/página e ao voltar do segundo plano.
  const [isCronosActive, setIsCronosActive] = useState(false)
  useEffect(() => {
    const read = () => {
      try {
        setIsCronosActive(localStorage.getItem(OLHO_DE_CRONOS.activeKey) === "1")
      } catch {
        setIsCronosActive(false)
      }
    }
    read()
    const onStorage = (e: StorageEvent) => {
      if (e.key === OLHO_DE_CRONOS.activeKey) read()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") read()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener(OLHO_DE_CRONOS.changedEvent, read as EventListener)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(OLHO_DE_CRONOS.changedEvent, read as EventListener)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  const [isKaykoActive, setIsKaykoActive] = useState(false)
  useEffect(() => {
    const read = () => {
      try {
        setIsKaykoActive(localStorage.getItem("kayko_robot_active") === "1")
      } catch {
        setIsKaykoActive(false)
      }
    }
    read()
    const onStorage = (e: StorageEvent) => {
      if (e.key === "kayko_robot_active") read()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") read()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("kayko:changed", read as EventListener)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("kayko:changed", read as EventListener)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  // Trader sentiment (simulated)

  // O preço vivo NÃO é mais lido aqui como estado reativo: ele vai para o live-price-store e é
  // consumido pelos componentes-folha (header/robô). Assim esta página (~1840 linhas) deixa de
  // reconciliar ~5x/s no tick de preço, o que era a causa dos cliques/toques lentos. A lógica de
  // dinheiro (liquidação/abertura) lê o preço sob demanda via multiAssetEngine + getLivePrice().
  const { candles, isConnected, realReady, realHistoryReady } = useGlobalOTC(
    selectedSymbol,
    timeframe as 60 | 300 | 600 | 900,
  )

  const currentBalance = useMemo(() => {
    const balance = accountType === "demo" ? balanceDemo : balanceReal
    return typeof balance === "number" && !isNaN(balance) ? balance : 0
  }, [accountType, balanceDemo, balanceReal])

  const selectedAsset = useMemo(
    () => availableAssets.find((a) => a.symbol === selectedSymbol) || availableAssets[0],
    [selectedSymbol, availableAssets],
  )

  const assetBySymbol = useCallback(
    (sym: string) => availableAssets.find((a) => a.symbol === sym),
    [availableAssets],
  )

  // Callbacks estáveis para os filhos memoizados (SidebarMenu / AssetPanel). Sem isso, uma nova
  // função seria criada a cada render (~10x/s pelo tick de preço) e o React.memo desses componentes
  // não teria efeito — eles re-renderizariam junto com a página mesmo sem mudança real de estado.
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), [])
  const handleOpenTraderIAFromMenu = useCallback(() => {
    setSidebarOpen(false)
    setTraderIAModalOpen(true)
  }, [])
  const handleCloseAssetPanel = useCallback(() => setShowAssetPanel(false), [])

  // Relógio que reavalia o horário de mercado periodicamente (para abrir/fechar sozinho).
  const [clockTick, setClockTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setClockTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // Earliest pending expiry per symbol. The per-second countdown lives in <TabTimer>, so the
  // page only recomputes this when activeTrades actually changes.
  const expiresAtBySymbol = useMemo(() => {
    const now = Date.now()
    const map: Record<string, number> = {}
    for (const t of activeTrades) {
      const expiresAt = t.timestamp + t.expiryTime * 1000
      if (expiresAt <= now) continue
      const current = map[t.symbol]
      if (current === undefined || expiresAt < current) map[t.symbol] = expiresAt
    }
    return map
  }, [activeTrades])

  // Status do mercado do ativo selecionado (fechado no fim de semana para forex de mercado aberto).
  const marketStatus = useMemo(
    () => getMarketStatus(selectedAsset, new Date(clockTick)),
    [selectedAsset, clockTick],
  )
  const marketClosed = !marketStatus.open

  // Duracoes disponiveis para o ativo atual: mercado aberto opera em 5m/10m/15m, OTC em
  // 1m/5m/10m (ver lib/trading/timeframes para o motivo).
  const timeframeOptions = useMemo(() => timeframesFor(selectedAsset?.symbol), [selectedAsset])

  // Ao trocar de ativo, a duracao selecionada pode nao existir na nova lista (ex.: estava em 1m
  // num OTC e mudou para um par de mercado aberto). Sem este ajuste a tela ficaria mostrando um
  // tempo indisponivel e a entrada seria recusada pelo servidor.
  useEffect(() => {
    setExpiryTime(prev => normalizeTimeframe(selectedAsset?.symbol, prev))
    setTimeframe(prev => normalizeTimeframe(selectedAsset?.symbol, prev))
  }, [selectedAsset?.symbol])

  // Janela de entrada considerando a duração escolhida: perto do fechamento, uma operação
  // que venceria depois dele não pode ser aberta (não haveria preço real para liquidar).
  const tradeWindow = useMemo(
    () => canOpenTrade(selectedAsset, expiryTime, new Date(clockTick)),
    [selectedAsset, expiryTime, clockTick],
  )
  const entryBlocked = !tradeWindow.allowed

  const nextOpenLabel = useMemo(() => {
    if (!marketStatus.nextOpen) return null
    return marketStatus.nextOpen.toLocaleString("pt-BR", {
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [marketStatus.nextOpen])

  // Garante que o ativo selecionado sempre tenha uma aba aberta
  useEffect(() => {
    setOpenTabs((tabs) => (tabs.includes(selectedSymbol) ? tabs : [...tabs, selectedSymbol]))
  }, [selectedSymbol])

  // Remove das abas os ativos que deixaram de existir (ex.: desativados pelo admin)
  useEffect(() => {
    if (availableAssets.length === 0) return
    setOpenTabs((tabs) => {
      const valid = tabs.filter((s) => availableAssets.some((a) => a.symbol === s))
      return valid.length ? valid : [availableAssets[0].symbol]
    })
  }, [availableAssets])

  // Fecha uma aba; se era a ativa, seleciona a vizinha. Nunca fecha a ultima.
  const closeTab = useCallback(
    (sym: string) => {
      setOpenTabs((tabs) => {
        if (tabs.length <= 1) return tabs
        const idx = tabs.indexOf(sym)
        const next = tabs.filter((s) => s !== sym)
        if (sym === selectedSymbol) {
          const fallback = next[Math.max(0, idx - 1)] || next[0]
          setSelectedSymbol(fallback)
        }
        return next
      })
    },
    [selectedSymbol],
  )

  const payout = selectedAsset?.payout ?? 96
  const expectedReturn = useMemo(() => Math.round(amount * (payout / 100) * 100) / 100, [amount, payout])

  const filteredAssets = useMemo(() => {
    // Primeiro filtra pela aba de mercado (OTC x Mercado aberto)
    const byMarket = availableAssets.filter((a) => (a.market || "otc") === assetMarketTab)
    if (!assetSearch) return byMarket
    const search = assetSearch.toLowerCase()
    return byMarket.filter(
      (a) => a.name.toLowerCase().includes(search) || a.symbol.toLowerCase().includes(search),
    )
  }, [assetSearch, availableAssets, assetMarketTab])

  const activeTradesForChart = useMemo(() => {
    return activeTrades.map((t) => ({
      id: t.id,
      // O ativo da operacao precisa chegar ao grafico: sem ele o grafico desenhava a linha de
      // TODAS as operacoes abertas, inclusive as de outros ativos.
      symbol: t.symbol,
      entryPrice: t.entryPrice || 0,
      direction: (t.direction || "call").toLowerCase() as "call" | "put",
      expiryTime: t.expiryTime || 60,
      timestamp: t.timestamp || Date.now(),
      amount: t.amount || 10,
    }))
  }, [activeTrades])

  // Desbloqueia o audio no primeiro gesto do usuario (necessario para mobile/Safari)
  useEffect(() => {
    const handler = () => unlockAudio()
    window.addEventListener("pointerdown", handler, { once: true })
    window.addEventListener("touchstart", handler, { once: true })
    return () => {
      window.removeEventListener("pointerdown", handler)
      window.removeEventListener("touchstart", handler)
    }
  }, [])

  // Check user authentication
  useEffect(() => {
    mountedRef.current = true
    const supabase = supabaseRef.current

    const checkUser = async () => {
      try {
        // A verificacao de sessao nao pode depender apenas de `getUser()`: ele faz uma chamada de
        // rede e, no mobile (Safari, conexao instavel ou retorno de bfcache/app minimizado), essa
        // promessa pode nunca resolver — deixando a tela travada em "Carregando..." para sempre.
        //
        // Por isso: primeiro pegamos a sessao local (sincrona, sem rede) para liberar a tela rapido;
        // e validamos `getUser()` com um timeout. Se a rede travar, usamos o usuario da sessao local
        // como fallback em vez de ficar preso.
        const withTimeout = (p: Promise<any>, ms: number): Promise<any> => {
          const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
          return Promise.race([p, timeout])
        }

        const sessionResult = await withTimeout(supabase.auth.getSession(), 4000)
        const sessionUser = sessionResult?.data?.session?.user ?? null

        const getUserResult = await withTimeout(supabase.auth.getUser(), 6000)

        if (!mountedRef.current) return

        // Sem sessao local E sem usuario validado => nao ha login: manda pro login.
        const currentUser = getUserResult?.data?.user ?? sessionUser
        const hardError = getUserResult?.error

        if (!currentUser || (hardError && !sessionUser)) {
          router.replace("/auth/login")
          return
        }

        setUser(currentUser)

        // Carrega status de afiliado (apenas informativo; NAO altera o resultado das operacoes)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_affiliate")
          .eq("id", currentUser.id)
          .maybeSingle()

        if (profileData?.is_affiliate) {
          setIsAffiliate(true)
          isAffiliateRef.current = true
        }

        // Load balances
        const { data: balanceData } = await supabase
          .from("user_balances")
          .select("balance_real, balance_demo")
          .eq("user_id", currentUser.id)
          .maybeSingle()

        if (!mountedRef.current) return

        if (balanceData) {
          setBalanceReal(balanceData.balance_real || 0)
          setBalanceDemo(balanceData.balance_demo || 10000)
        } else {
          // Create default balance
          await supabase.from("user_balances").insert({
            user_id: currentUser.id,
            balance_real: 0,
            balance_demo: 10000,
            currency: "BRL",
          })
          setBalanceDemo(10000)
        }

        await finalizeExpiredTrades(currentUser.id)

        setLoading(false)
      } catch (err) {
        if (mountedRef.current) {
          router.replace("/auth/login")
        }
      }
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any) => {
      if (event === "SIGNED_OUT" && mountedRef.current) {
        router.replace("/auth/login")
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [router])

  // Ids (no banco) das operacoes que a pagina esta acompanhando em memoria e que, portanto,
  // serao liquidadas pelo caminho que exibe a animacao. A rede de seguranca abaixo precisa
  // ignora-las: antes ela encerrava essas mesmas operacoes por conta propria — creditando o
  // saldo, porem sem animacao nenhuma — e o caminho da animacao, ao encontrar a operacao ja
  // encerrada, apenas a descartava em silencio. Como a rede roda a cada 3s e a verificacao com
  // animacao a cada 500ms, era uma corrida: com varias operacoes abertas a rede ganhava com
  // frequencia, e era por isso que a animacao "quase sempre" nao aparecia.
  const trackedDbIdsRef = useRef<Set<string>>(new Set())

  const finalizeExpiredTrades = useCallback(async (userId: string) => {
    try {
      const supabase = supabaseRef.current

      // Buscar trades pendentes que já expiraram
      const { data: pendingTrades, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .eq("result", "pending")
        .not("entry_time", "is", null)

      if (error || !pendingTrades || pendingTrades.length === 0) return

      // Filter only truly expired trades
      const now = Date.now()
      const expiredTrades = pendingTrades.filter((t: any) => {
        // Operacao acompanhada na tela: deixa para o caminho que mostra a animacao.
        if (trackedDbIdsRef.current.has(t.id)) return false
        const entryMs = new Date(t.entry_time).getTime()
        const fixedExpiry = t.expiry_time ? new Date(t.expiry_time).getTime() : Number.NaN
        const expiresAt = Number.isFinite(fixedExpiry) ? fixedExpiry : entryMs + (t.timeframe || 60) * 1000
        return now >= expiresAt
      })

      if (expiredTrades.length === 0) return

      for (const trade of expiredTrades) {
        // Preco de saida: o preco ATUAL do motor para o ativo — o mesmo que alimenta o grafico,
        // garantindo que o resultado seja consistente com o que o usuario viu.
        //
        // NAO existe mais fallback aleatorio aqui. Antes, quando o motor nao tinha preco, a
        // operacao era liquidada em `entry_price * (1 + (Math.random() - 0.5) * 0.01)`: ganho ou
        // perda decidido por sorteio, com desvio de ate 0,5% sobre a entrada. Agora, sem preco a
        // operacao permanece pendente e e liquidada no proximo ciclo (roda a cada 3s), quando
        // houver cotacao real.
        const enginePrice = multiAssetEngine.getCurrentPrice(trade.symbol)
        if (!enginePrice || enginePrice <= 0) continue
        const exitPrice = enginePrice
        const isWin =
          trade.direction === "CALL" ? exitPrice > trade.entry_price : exitPrice < trade.entry_price
        const result = isWin ? "win" : "loss"
        const profitAmount = isWin ? trade.amount * (trade.payout_percentage || 0.96) : -trade.amount

        // A operacao SO e marcada como encerrada aqui. Duas correcoes importantes neste update:
        //
        // 1. Antes gravava `exit_time`, coluna que NAO existe em `trades` (o nome correto e
        //    `closed_at`). O Postgres recusava o update inteiro com erro PGRST204, entao a operacao
        //    ficava eternamente com result='pending' — era isso que travava o cronometro em "0s".
        // 2. O erro nao era verificado. Como o registro continuava 'pending', a consulta acima
        //    pegava a MESMA operacao no ciclo seguinte (a cada 3s) e creditava o ganho de novo, sem
        //    limite. Agora, se o update falhar, abortamos antes de creditar qualquer coisa.
        const { data: closedRows, error: closeError } = await supabase
          .from("trades")
          .update({
            result,
            profit: profitAmount,
            exit_price: exitPrice,
            closed_at: new Date().toISOString(),
            status: "closed",
          })
          .eq("id", trade.id)
          .eq("result", "pending") // so encerra se ainda estiver pendente
          .select("id")

        // O credito depende de ESTE update ter encerrado a operacao de fato. Se deu erro, ou se
        // nenhuma linha foi afetada (outro caminho de liquidacao fechou primeiro), nao creditamos:
        // e o que impede o mesmo ganho de ser pago duas vezes.
        if (closeError || !closedRows || closedRows.length === 0) {
          if (closeError) {
            console.error("[v0] Falha ao encerrar operacao, credito abortado:", closeError.message)
          }
          continue
        }

        // Se ganhou, creditar o saldo
        if (isWin) {
          const balanceField = trade.is_demo ? "balance_demo" : "balance_real"
          const returnAmount = trade.amount + trade.amount * (trade.payout_percentage || 0.96)

          const { data: balanceData } = await supabase
            .from("user_balances")
            .select(balanceField)
            .eq("user_id", userId)
            .single()

          if (balanceData) {
            const currentBal = balanceData[balanceField] || 0
            await supabase
              .from("user_balances")
              .update({ [balanceField]: currentBal + returnAmount })
              .eq("user_id", userId)
          }
        }
      }

      // Atualizar histórico
      setHistoryRefresh((prev) => prev + 1)
    } catch (err) {
      console.error("[v0] Erro ao finalizar trades expirados:", err)
    }
  }, [])

  // Rede de seguranca: finaliza no banco qualquer operacao expirada, mesmo que o
  // preco ao vivo esteja 0 ou a operacao nao esteja mais na lista em memoria.
  // Isso resolve o caso do cronometro travar em "0s" sem mostrar o resultado.
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      if (mountedRef.current) finalizeExpiredTrades(user.id)
    }, 3000)
    return () => clearInterval(interval)
  }, [user, finalizeExpiredTrades])

  // Mantem `trackedDbIdsRef` espelhando as operacoes ativas, para a rede de seguranca saber
  // quais operacoes ja tem dono. Se a aba for fechada no meio, a lista em memoria desaparece e
  // a rede volta a cuidar delas normalmente no proximo carregamento.
  useEffect(() => {
    trackedDbIdsRef.current = new Set(
      activeTrades.map((t) => t.dbId).filter((id): id is string => !!id),
    )
  }, [activeTrades])

  // Track processed trade IDs to prevent double-processing
  const processedTradesRef = useRef<Set<string>>(new Set())

  /**
   * Recarrega do banco as operacoes que ainda estao abertas.
   *
   * BUG CORRIGIDO — "fiz uma venda e nao marcou a linha no grafico":
   * `activeTrades` (a unica fonte das linhas do grafico) so era preenchido no momento em que a
   * operacao era criada, e nunca era reconstruido a partir do banco. Ou seja: a lista vivia
   * apenas na memoria daquela sessao da pagina. Bastava a pagina remontar — F5, o Chrome
   * descartar a aba deixada em segundo plano (comum ao minimizar por um tempo), voltar pelo
   * historico ou um novo deploy — para as operacoes abertas desaparecerem do grafico
   * permanentemente, enquanto o painel Historico continuava mostrando cada uma contando o tempo,
   * porque ele le direto do banco. Era exatamente o sintoma relatado: operacao ativa na lista,
   * nenhuma linha no grafico.
   *
   * Agora as operacoes abertas sao lidas do banco ao montar a pagina e a cada retorno para a aba,
   * entao a linha reaparece sozinha. Somente operacoes que ainda nao expiraram sao restauradas;
   * as vencidas continuam por conta de `finalizeExpiredTrades`.
   */
  const hydrateActiveTrades = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabaseRef.current
          .from("trades")
          .select("id, symbol, entry_price, direction, timeframe, entry_time, expiry_time, amount, is_demo")
          .eq("user_id", userId)
          .in("result", ["pending", "PENDING"])
          .not("entry_time", "is", null)

        if (error || !data?.length) return

        const now = Date.now()

        setActiveTrades((prev) => {
          const conhecidas = new Set(prev.map((t) => t.dbId).filter(Boolean))
          const restauradas: ActiveTrade[] = []

          for (const row of data as any[]) {
            if (conhecidas.has(row.id)) continue // ja esta no grafico
            if (processedTradesRef.current.has(`db-${row.id}`)) continue // ja liquidada nesta sessao

            const timestamp = new Date(row.entry_time).getTime()
            if (!Number.isFinite(timestamp)) continue
            const fixedExpiry = row.expiry_time ? new Date(row.expiry_time).getTime() : Number.NaN
            const expiryTime = Number.isFinite(fixedExpiry)
              ? Math.max(1, Math.round((fixedExpiry - timestamp) / 1000))
              : Number(row.timeframe) || 60
            // Ja venceu: quem encerra e o finalizeExpiredTrades, nao entra como linha ativa.
            if (now >= timestamp + expiryTime * 1000) continue

            const entryPrice = Number(row.entry_price) || 0
            if (entryPrice <= 0) continue // sem preco de entrada nao existe linha para desenhar

            // Marcada como acompanhada na tela para que a liquidacao siga o caminho com animacao.
            trackedDbIdsRef.current.add(row.id)

            restauradas.push({
              id: `db-${row.id}`,
              dbId: row.id,
              symbol: row.symbol,
              direction: (String(row.direction || "call").toUpperCase() === "PUT"
                ? "PUT"
                : "CALL") as "CALL" | "PUT",
              amount: Number(row.amount) || 0,
              entryPrice,
              expiryTime,
              timestamp,
              isDemo: Boolean(row.is_demo),
            })
          }

          return restauradas.length > 0 ? [...prev, ...restauradas] : prev
        })
      } catch {}
    },
    [],
  )

  // Restaura as linhas ao abrir a pagina e sempre que a aba volta a ficar visivel.
  useEffect(() => {
    if (!user?.id) return
    const userId = user.id

    const run = () => {
      if (typeof document !== "undefined" && document.hidden) return
      void hydrateActiveTrades(userId)
    }

    run()
    document.addEventListener("visibilitychange", run)
    window.addEventListener("focus", run)
    window.addEventListener("pageshow", run)
    return () => {
      document.removeEventListener("visibilitychange", run)
      window.removeEventListener("focus", run)
      window.removeEventListener("pageshow", run)
    }
  }, [user?.id, hydrateActiveTrades])

  // Reconcilia depositos PIX pendentes do proprio usuario ao abrir a pagina e sempre que a aba
  // volta a ficar visivel (ex.: cliente acabou de pagar no app do banco e voltou para o app).
  // Credita o saldo em segundos sem depender do webhook chegar na hora nem do cron diario.
  useEffect(() => {
    if (!user?.id) return

    const reconcile = async () => {
      if (typeof document !== "undefined" && document.hidden) return
      try {
        const res = await fetch("/api/deposits/reconcile", { method: "POST" })
        const data = await res.json().catch(() => null)
        // Se algum deposito foi creditado agora, recarrega o saldo real da conta.
        if (data?.approved > 0 && mountedRef.current) {
          const { data: balanceData } = await supabaseRef.current
            .from("user_balances")
            .select("balance_real")
            .eq("user_id", user.id)
            .maybeSingle()
          if (balanceData && mountedRef.current) {
            setBalanceReal(balanceData.balance_real || 0)
          }
        }
      } catch {}
    }

    void reconcile()
    document.addEventListener("visibilitychange", reconcile)
    window.addEventListener("focus", reconcile)
    return () => {
      document.removeEventListener("visibilitychange", reconcile)
      window.removeEventListener("focus", reconcile)
    }
  }, [user?.id])

  // Latest values read by the settlement loop, so the interval is created once per session
  // instead of being torn down and rebuilt on every activeTrades/payout change.
  const activeTradesRef = useRef(activeTrades)
  activeTradesRef.current = activeTrades
  const payoutRef = useRef(payout)
  payoutRef.current = payout
  const settlingRef = useRef(false)
  const hasOpenTrades = activeTrades.length > 0

  // Check active trades results - ROBUST
  useEffect(() => {
    if (!hasOpenTrades || !user || !mountedRef.current) return

    const checkTradeResults = async () => {
      // Each run awaits several network calls; overlapping runs every 500ms piled up requests
      // and state updates, which is what froze the UI when multiple trades expired together.
      if (!mountedRef.current || settlingRef.current) return

      const now = Date.now()
      const tradesToFinalize: ActiveTrade[] = []

      for (const trade of activeTradesRef.current) {
        const expiresAt = trade.timestamp + trade.expiryTime * 1000
        if (now < expiresAt || processedTradesRef.current.has(trade.id)) continue
        if (multiAssetEngine.getCurrentPrice(trade.symbol) > 0) tradesToFinalize.push(trade)
      }
      if (tradesToFinalize.length === 0) return

      settlingRef.current = true
      const payout = payoutRef.current
      try {
        await settleTrades(tradesToFinalize, payout)
      } finally {
        settlingRef.current = false
      }
    }

    const settleTrades = async (tradesToFinalize: ActiveTrade[], payout: number) => {
      for (const trade of tradesToFinalize) {
        if (!mountedRef.current) break

        // Mark as being processed to prevent race conditions.
        // Marca tambem a chave `db-<dbId>`: e essa chave que o hydrateActiveTrades usa para
        // deduplicar. Sem ela, uma operacao recem-finalizada cuja linha no banco ainda consta
        // 'pending' era re-adicionada pelo hydrate (ao focar/voltar a aba) com o timestamp do
        // relogio do servidor, criando uma segunda entrada no mesmo ativo. O contador entao
        // alternava entre os dois tempos a cada render — era esse o bug do timer "pulando".
        processedTradesRef.current.add(trade.id)
        if (trade.dbId) processedTradesRef.current.add(`db-${trade.dbId}`)

        try {
          // Resultado REAL baseado no movimento do preco, para TODOS os usuarios
          // (sem vitoria forcada para demo nem para afiliado).
          //
          // IMPORTANTE: a saida usa a MESMA fonte de preco da entrada — o motor multi-ativos
          // (multiAssetEngine), que tambem alimenta o grafico. A entrada e capturada de
          // multiAssetEngine.getCurrentPrice (ver openTrade) e o caminho da rede de seguranca ja
          // liquida pelo motor. Este caminho, porem, comparava a saida contra `price` (o feed
          // `use-global-otc` do topo da tela), um numero DIFERENTE do motor. Quando os dois
          // divergiam, uma operacao que o usuario viu fechar no verde no grafico podia ser marcada
          // como loss — era exatamente o "foi green e marcou loss". Agora ambos usam o motor.
          const enginePrice = multiAssetEngine.getCurrentPrice(trade.symbol)
          const exitPrice = enginePrice > 0 ? enginePrice : getLivePrice()
          const isWin =
            trade.direction === "CALL" ? exitPrice > trade.entryPrice : exitPrice < trade.entryPrice
          const result = isWin ? "win" : "loss"
          const profitAmount = isWin ? Math.round(trade.amount * (payout / 100) * 100) / 100 : 0

          // Localiza a linha desta operacao.
          //
          // Antes esta consulta pegava a operacao pendente MAIS RECENTE do ativo
          // (`order created_at desc limit 1`), sem qualquer vinculo com a operacao que
          // realmente expirou. Com duas ou mais pendentes no mesmo ativo isso causava os dois
          // sintomas relatados: a operacao que expirou encerrava a linha da outra (resultado
          // trocado) e, quando a segunda expirava, sua linha ja tinha sido consumida — caia no
          // `!existingTrade` abaixo e era removida em silencio, sem nenhuma animacao.
          //
          // Agora usamos o id real gravado na criacao, entao cada operacao encerra a sua propria
          // linha. O caminho antigo continua como reserva apenas para operacoes que ja estavam
          // ativas antes desta correcao (sem `dbId`).
          let existingTrade: { id: string; result: string } | undefined
          let fetchError: unknown = null

          if (trade.dbId) {
            const { data, error } = await supabaseRef.current
              .from("trades")
              .select("id, result")
              .eq("id", trade.dbId)
              .maybeSingle()
            existingTrade = data ?? undefined
            fetchError = error
          } else {
            const { data, error } = await supabaseRef.current
              .from("trades")
              .select("id, result")
              .eq("user_id", user.id)
              .eq("symbol", trade.symbol)
              .eq("is_demo", trade.isDemo)
              .in("result", ["pending", "PENDING"])
              .order("created_at", { ascending: true })
              .limit(1)
            existingTrade = data?.[0]
            fetchError = error
          }

          if (fetchError) {
            // Erro transitorio (rede/limite) — comum quando varias operacoes de ativos
            // diferentes expiram juntas e disparam muitas consultas ao mesmo tempo. NAO remover
            // a operacao: isso apagaria a linha do grafico e ainda deixaria a operacao sem
            // liquidar. Libera o "processed" para tentar de novo no proximo ciclo (500ms).
            processedTradesRef.current.delete(trade.id)
            if (trade.dbId) processedTradesRef.current.delete(`db-${trade.dbId}`)
            continue
          }

          if (!existingTrade) {
            // O banco respondeu sem erro e a linha realmente nao existe — remove o fantasma.
            setActiveTrades((prev) => prev.filter((t) => t.id !== trade.id))
            continue
          }

          // Already processed by another path
          if (existingTrade.result !== "pending" && existingTrade.result !== "PENDING") {
            setActiveTrades((prev) => prev.filter((t) => t.id !== trade.id))
            continue
          }

          // Update trade in DB
          // Mesma correcao do outro caminho de liquidacao: `exit_time` nao existe na tabela, o nome
          // correto e `closed_at`. Com o nome errado o update era recusado (PGRST204), este bloco
          // caia sempre no `updateError` abaixo e a operacao nunca era encerrada — ficava presa em
          // 'pending' e era reprocessada indefinidamente.
          const { data: closedRows, error: updateError } = await supabaseRef.current
            .from("trades")
            .update({
              exit_price: exitPrice,
              closed_at: new Date().toISOString(),
              status: "closed",
              result,
              profit: isWin ? profitAmount : -trade.amount,
            })
            .eq("id", existingTrade.id)
            .in("result", ["pending", "PENDING"])
            .select("id")

          if (updateError || !closedRows || closedRows.length === 0) {
            processedTradesRef.current.delete(trade.id)
            if (trade.dbId) processedTradesRef.current.delete(`db-${trade.dbId}`)
            continue
          }

          // Update balance - re-fetch from DB for accuracy
          if (isWin) {
            const returnAmount = Math.round((trade.amount + profitAmount) * 100) / 100
            const balanceField = trade.isDemo ? "balance_demo" : "balance_real"

            // Fetch latest balance from DB first
            const { data: freshBalance } = await supabaseRef.current
              .from("user_balances")
              .select(balanceField)
              .eq("user_id", user.id)
              .single()

            if (freshBalance) {
              const latestBal = freshBalance[balanceField] || 0
              const newBalance = Math.round((latestBal + returnAmount) * 100) / 100

              await supabaseRef.current
                .from("user_balances")
                .update({ [balanceField]: newBalance })
                .eq("user_id", user.id)

              if (mountedRef.current) {
                if (trade.isDemo) {
                  setBalanceDemo(newBalance)
                } else {
                  setBalanceReal(newBalance)
                }
              }
            }
          }

          if (mountedRef.current) {
            // Placar do robô KAYKO: reflete o resultado real desta entrada.
            window.dispatchEvent(
              new CustomEvent("kayko:trade-result", {
                detail: { result, profit: isWin ? profitAmount : -trade.amount, openedAt: trade.timestamp },
              }),
            )
            // Entra na fila em vez de sobrescrever o resultado anterior.
            setResultQueue((prev) => [
              ...prev,
              { key: trade.id, type: result, amount: isWin ? profitAmount : trade.amount },
            ])
            setActiveTrades((prev) => prev.filter((t) => t.id !== trade.id))
            setHistoryRefresh((prev) => prev + 1)

            // Play win/loss sound
            if (isWin) playWinSound()
            else playLossSound()
          }
        } catch (err) {
          processedTradesRef.current.delete(trade.id)
        }
      }
    }

    // Check immediately on mount, then every 500ms for faster response
    checkTradeResults()
    const interval = setInterval(checkTradeResults, 500)
    return () => clearInterval(interval)
  }, [hasOpenTrades, user])

  const executeTrade = useCallback(
    async (direction: "CALL" | "PUT") => {
      if (isTrading || !user) {
        return
      }

      // Duracao permitida para o ativo. Esta pagina grava a operacao direto no banco, entao a
      // regra precisa valer aqui tambem — nao apenas na rota de API.
      if (!isTimeframeAllowed(selectedSymbol, expiryTime)) {
        const permitidos = timeframesFor(selectedSymbol)
          .map(tf => TIMEFRAME_LABELS[tf])
          .join(", ")
        setTradeError(`Tempo indisponivel para este ativo. Use: ${permitidos}.`)
        setTimeout(() => setTradeError(null), 3000)
        return
      }

      // Bloqueia quando o mercado do ativo está fechado (ex.: forex no fim de semana) e também
      // quando está aberto mas a operação venceria depois do fechamento — nesse caso não
      // existiria preço real para liquidar.
      const window = canOpenTrade(selectedAsset, expiryTime)
      if (!window.allowed) {
        setTradeError(window.reason || "Mercado fechado")
        setTimeout(() => setTradeError(null), 3000)
        return
      }

      // Validations
      if (amount <= 0) {
        setTradeError("Valor deve ser maior que zero")
        setTimeout(() => setTradeError(null), 3000)
        return
      }

      if (amount > currentBalance) {
        setTradeError("Saldo insuficiente")
        setTimeout(() => setTradeError(null), 3000)
        return
      }

      // Preco de entrada do ativo SELECIONADO. Antes o fallback era um numero fixo (1.085, o
      // preco do EUR/USD): quando `price` vinha 0 — tipico ao alternar entre varias abas, com o
      // feed do ativo recem-focado ainda carregando — a operacao era gravada em 1.085 e a linha
      // tracejada caia fora da area visivel de qualquer ativo que nao valesse ~1,08 (BTC, USD/JPY,
      // etc.), dando o sintoma "a linha nao aparece". O motor deterministico calcula o preco de
      // QUALQUER ativo sob demanda, entao usamos ele como fonte autoritativa. Sem cotacao (feed de
      // mercado aberto ainda fora), bloqueamos a entrada em vez de gravar um preco falso que
      // tambem corromperia a liquidacao.
      // O preco de entrada precisa ser SEMPRE o do ativo selecionado (a aba onde a operacao
      // esta sendo aberta). Ao abrir varias operacoes em abas de ativos diferentes em sequencia
      // rapida, o estado `price` pode ainda refletir por um instante o preco do ativo ANTERIOR
      // (o hook do novo ativo acabou de trocar) — gravando a entrada num preco que cai fora da
      // faixa visivel do grafico do novo ativo, e a linha tracejada "some". O motor
      // deterministico devolve o preco exato do ativo sob demanda e e a MESMA fonte que o
      // grafico usa para desenhar (e para liquidar no servidor), entao a linha fica sempre
      // dentro da area visivel e o preco de entrada fica consistente com a liquidacao.
      const enginePrice = multiAssetEngine.getCurrentPrice(selectedSymbol)
      const entryPrice = enginePrice > 0 ? enginePrice : getLivePrice()
      if (!entryPrice || entryPrice <= 0) {
        setTradeError("Aguardando cotacao do ativo. Tente novamente em instantes.")
        setTimeout(() => setTradeError(null), 3000)
        return
      }

      // Toca o som AQUI (sincrono, ainda dentro do gesto de clique do usuario).
      // Se tocado apos os awaits abaixo, o navegador ja perdeu o contexto do gesto e
      // o AudioContext fica suspenso (sem som), principalmente no mobile.
      if (direction === "CALL") playCallSound()
      else playPutSound()

      setIsTrading(true)
      setTradeError(null)

      try {
        const tradeId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        // Vence sempre num minuto cheio (estilo IQ Option), igual ao horario mostrado no painel.
        const openedAt = Date.now()
        const effectiveSeconds = Math.max(1, Math.round((expiryAtFor(openedAt, expiryTime) - openedAt) / 1000))
        const entryTime = new Date(openedAt)
        const expiryTimeDate = new Date(openedAt + effectiveSeconds * 1000)
        const isDemo = accountType === "demo"

        // Deduct balance first
        const newBalance = Math.round((currentBalance - amount) * 100) / 100
        const balanceField = isDemo ? "balance_demo" : "balance_real"

        const { error: balanceError } = await supabaseRef.current
          .from("user_balances")
          .update({ [balanceField]: newBalance })
          .eq("user_id", user.id)

        if (balanceError) {
          throw new Error("Erro ao atualizar saldo")
        }

        if (isDemo) {
          setBalanceDemo(newBalance)
        } else {
          setBalanceReal(newBalance)
        }

        const tradeData = {
          user_id: user.id,
          symbol: selectedSymbol,
          direction: direction,
          amount: Math.round(amount * 100) / 100,
          entry_price: entryPrice,
          entry_time: entryTime.toISOString(),
          timeframe: expiryTime,
          expiry_time: expiryTimeDate.toISOString(),
          payout_percentage: payout / 100,
          is_demo: isDemo,
          result: "pending",
        }

        // `.select()` devolve a linha criada. Precisamos do id dela para encerrar exatamente
        // esta operacao depois, em vez de procurar "a pendente mais recente" do ativo.
        const { data: insertedTrade, error: insertError } = await supabaseRef.current
          .from("trades")
          .insert(tradeData)
          .select("id")
          .single()

        if (insertError) {
          // Rollback balance
          await supabaseRef.current
            .from("user_balances")
            .update({ [balanceField]: currentBalance })
            .eq("user_id", user.id)

          if (isDemo) {
            setBalanceDemo(currentBalance)
          } else {
            setBalanceReal(currentBalance)
          }

          throw new Error(insertError.message || "Erro ao criar operação")
        }

        // Add to active trades for chart display
        const activeTrade: ActiveTrade = {
          id: tradeId,
          dbId: insertedTrade?.id,
          symbol: selectedSymbol,
          direction: direction, // UPPERCASE
          amount,
          entryPrice: entryPrice,
          expiryTime: effectiveSeconds,
          timestamp: openedAt,
          isDemo,
        }

        setActiveTrades((prev) => [...prev, activeTrade])
        setHistoryRefresh((prev) => prev + 1)
      } catch (err: any) {
        setTradeError(err?.message || "Erro ao executar operação")
        setTimeout(() => setTradeError(null), 3000)
      } finally {
        setIsTrading(false)
      }
    },
    [user, amount, currentBalance, selectedSymbol, expiryTime, accountType, payout, isTrading, marketStatus],
  )

  // Venda antecipada: encerra a operacao agora pelo valor de venda calculado em tempo real.
  const sellTrades = useCallback(
    async (ids: string[]) => {
      if (!user) return
      for (const id of ids) {
        const trade = activeTradesRef.current.find((t) => t.id === id)
        if (!trade?.dbId || processedTradesRef.current.has(trade.id)) continue
        const enginePrice = multiAssetEngine.getCurrentPrice(trade.symbol)
        const price = enginePrice > 0 ? enginePrice : getLivePrice()
        if (!price || price <= 0) continue
        const state = liveTradeState(trade, price, payoutRef.current)
        if (state.remainingMs <= 0) continue

        processedTradesRef.current.add(trade.id)
        processedTradesRef.current.add(`db-${trade.dbId}`)
        const release = () => {
          processedTradesRef.current.delete(trade.id)
          processedTradesRef.current.delete(`db-${trade.dbId}`)
        }

        try {
          const { data: closedRows, error } = await supabaseRef.current
            .from("trades")
            .update({
              exit_price: price,
              closed_at: new Date().toISOString(),
              status: "closed",
              result: state.sellPnl >= 0 ? "win" : "loss",
              profit: state.sellPnl,
            })
            .eq("id", trade.dbId)
            .in("result", ["pending", "PENDING"])
            .select("id")
          if (error || !closedRows?.length) {
            release()
            continue
          }

          const balanceField = trade.isDemo ? "balance_demo" : "balance_real"
          const { data: fresh } = await supabaseRef.current
            .from("user_balances")
            .select(balanceField)
            .eq("user_id", user.id)
            .single()
          if (fresh) {
            const newBalance = Math.round(((fresh as any)[balanceField] + state.sellValue) * 100) / 100
            await supabaseRef.current.from("user_balances").update({ [balanceField]: newBalance }).eq("user_id", user.id)
            if (trade.isDemo) setBalanceDemo(newBalance)
            else setBalanceReal(newBalance)
          }

          setActiveTrades((prev) => prev.filter((t) => t.id !== trade.id))
          setHistoryRefresh((prev) => prev + 1)
          if (state.sellPnl >= 0) playWinSound()
          else playLossSound()
        } catch {
          release()
        }
      }
    },
    [user],
  )

  const handleExpiryChange = useCallback(
    (delta: number) => {
      const currentIndex = timeframeOptions.indexOf(expiryTime as Timeframe)
      const newIndex = Math.max(0, Math.min(timeframeOptions.length - 1, currentIndex + delta))
      setExpiryTime(timeframeOptions[newIndex])
    },
    [expiryTime, timeframeOptions],
  )

  const handleAmountChange = useCallback(
    (delta: number) => {
      setAmount((prev) => Math.max(1, Math.min(currentBalance || 10000, prev + delta)))
    },
    [currentBalance],
  )

  const [isDesktop, setIsDesktop] = useState(false)
  const [sidePanel, setSidePanel] = useState<SidePanelId | null>(null)
  const navConfig = useNavConfig()
  const priceAlerts = usePriceAlerts(playAlertTone)
  const openNavItem = useCallback((id: NavItemId) => {
    if (id === "portfolio") {
      setSidePanel(null)
      setPortfolioOpen(true)
      return
    }
    setSidePanel((cur) => (cur === id ? null : id))
  }, [])
  const [portfolioOpen, setPortfolioOpen] = useState(false)
  const openPositions = useMemo(
    () => activeTrades.filter((t) => t.isDemo === (accountType === "demo")),
    [activeTrades, accountType],
  )
  const investedAmount = useMemo(
    () =>
      activeTrades
        .filter((t) => t.isDemo === (accountType === "demo"))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [activeTrades, accountType],
  )

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    checkDesktop()
    window.addEventListener("resize", checkDesktop)
    return () => window.removeEventListener("resize", checkDesktop)
  }, [])

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tr-chart">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-tr-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-tr-chart font-sans">
      {/* Header */}
      <header className="flex h-14 lg:h-[71px] shrink-0 items-center gap-2 lg:gap-4 border-b border-tr-chart bg-tr-rail px-2 lg:px-4">
        {/* Menu (mobile) */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-sm bg-tr-raised text-tr-muted active:scale-95 shrink-0"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Logo */}
        <a href="/" className="hidden lg:flex items-center gap-2 shrink-0 pr-2" aria-label="Bullion Trader - início">
          <img src="/images/bullion-trader-logo.png" alt="" className="h-10 w-10 rounded-full object-cover" />
          <span className="text-lg font-bold tracking-tight text-tr-brand">Bullion Trader</span>
        </a>

        {/* Seletor de ativo (mobile) */}
        <button
          onClick={() => setShowAssetModal(true)}
          className="flex lg:hidden items-center gap-2 px-2.5 py-1.5 rounded-sm bg-tr-raised min-w-0 flex-1"
        >
          <div className="w-7 h-7 rounded-full overflow-hidden bg-tr-line shrink-0">
            <Image
              src={selectedAsset?.logo || "/placeholder.svg"}
              alt={selectedAsset?.name || "Ativo"}
              width={28}
              height={28}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-left min-w-0">
            <p className="text-tr-fg font-bold text-xs leading-tight truncate">{selectedAsset?.name || "Selecionar"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <LivePriceText
                decimals={selectedAsset?.symbol?.includes("JPY") ? 3 : 5}
                className="text-tr-up text-[10px] font-mono font-semibold"
              />
              <span className="text-[9px] px-1 bg-tr-up/15 text-tr-up rounded font-bold">{payout}%</span>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-tr-muted shrink-0" />
        </button>

        {/* Abas de ativos (desktop) */}
        <div className="hidden lg:flex items-center gap-3 min-w-0 flex-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setShowAssetPanel(true)}
            aria-label="Todos os ativos"
            className="w-12 h-12 flex items-center justify-center rounded-sm border border-tr-line bg-tr-raised/40 text-tr-muted hover:text-tr-fg transition-colors shrink-0"
          >
            <LayoutGrid className="w-6 h-6" fill="currentColor" />
          </button>

          {openTabs.map((sym) => {
            const asset = assetBySymbol(sym)
            if (!asset) return null
            const isActive = sym === selectedSymbol
            return (
              <div
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedSymbol(sym)
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                className={`group relative flex h-12 items-center gap-2 pl-3 pr-4 cursor-pointer shrink-0 rounded-sm transition-colors ${
                  isActive ? "bg-tr-raised" : "hover:bg-tr-raised/50"
                }`}
              >
                {openTabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(sym)
                    }}
                    aria-label={`Fechar ${asset.name}`}
                    className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-tr-muted opacity-0 group-hover:opacity-100 hover:text-tr-fg transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <TraderoomTabStatus
                  name={asset.name}
                  logo={asset.logo}
                  isOtc={(asset.market || "otc") === "otc"}
                  positions={openPositions.filter((p) => p.symbol === sym)}
                  payout={asset.payout ?? payout}
                />
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-tr-brand" />}
              </div>
            )
          })}

          <button
            onClick={() => setShowAssetPanel(true)}
            aria-label="Adicionar ativo"
            className="w-12 h-12 flex items-center justify-center rounded-sm border border-tr-line text-tr-muted hover:text-tr-fg transition-colors shrink-0"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
        </div>

        {/* Direita: payout, saldo, depósito */}
        <div className="flex items-center gap-2 lg:gap-6 shrink-0 ml-auto">
          <TraderoomProfileMenu
            email={user?.email || ""}
            createdAt={user?.created_at}
            userId={user?.id || ""}
            progress={historyRefresh > 0 || activeTrades.length > 0 ? 100 : 80}
            onSignOut={async () => {
              await supabaseRef.current.auth.signOut()
              router.push("/auth/login")
            }}
          />

          <TraderoomBalanceMenu
            accountType={accountType}
            balanceReal={balanceReal}
            balanceDemo={balanceDemo}
            invested={investedAmount}
            onChangeAccount={setAccountType}
          />

          <a
            href="/deposit"
            className="flex h-9 lg:h-12 items-center gap-2 rounded-sm border border-tr-up px-2.5 lg:px-5 text-tr-up hover:bg-tr-up/10 transition-colors"
          >
            <CircleDollarSign className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden="true" />
            <span className="hidden sm:inline text-sm lg:text-xl">Depositar</span>
          </a>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <TraderoomNav
          active={sidePanel}
          portfolioOpen={portfolioOpen}
          config={navConfig.config}
          alertCount={priceAlerts.triggered.length}
          onSelect={openNavItem}
          onMore={() => setSidePanel((cur) => (cur === "more" ? null : "more"))}
        />

        {sidePanel && (
          <TraderoomSidePanel
            panel={sidePanel}
            onClose={() => setSidePanel(null)}
            onOpen={openNavItem}
            userId={user?.id || ""}
            historyRefresh={historyRefresh}
            isDemo={accountType === "demo"}
            navConfig={navConfig.config}
            onToggleNavItem={navConfig.toggle}
            onMoveNavItem={navConfig.move}
            symbol={selectedAsset?.symbol || selectedSymbol}
            symbolName={selectedAsset?.name || selectedSymbol}
            alerts={priceAlerts.alerts}
            triggeredAlerts={priceAlerts.triggered}
            onAddAlert={priceAlerts.addAlert}
            onRemoveAlert={priceAlerts.removeAlert}
            onClearTriggered={priceAlerts.clearTriggered}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 flex min-h-0">
            {/* Gráfico */}
            <div className="flex-1 min-w-0 relative">
              <div className="absolute inset-0">
                {isTraderIAActive && <TraderIAWatermark isActive={isTraderIAActive} />}
                {isCronosActive && (
                  <KaykoRobot
                    isActive={isCronosActive}
                    assetName={selectedAsset?.name}
                    symbol={selectedSymbol}
                    expirySeconds={expiryTime}
                    robot={OLHO_DE_CRONOS}
                    initialY={130}
                  />
                )}
                <MarketChart
                  candles={candles || []}
                  currentPrice={getLivePrice() || 0}
                  activeTrades={activeTradesForChart}
                  timeframe={timeframe as 60 | 300 | 600 | 900}
                  symbol={selectedSymbol}
                  payout={payout / 100}
                  reloadKey={(realReady ? 1 : 0) + (realHistoryReady ? 2 : 0)}
                  hoverDirection={hoverDirection}
                  expirySeconds={expiryTime}
                  timeframeOptions={timeframeOptions}
                  onTimeframeChange={setTimeframe}
                />
                <TraderoomActiveTradeBar
                  symbol={selectedSymbol}
                  positions={openPositions.filter((p) => p.symbol === selectedSymbol)}
                  payout={payout}
                  onSell={sellTrades}
                />
                <TraderoomChartOverlay
                  symbol={selectedSymbol}
                  assetName={selectedAsset?.name || ""}
                  assetLogo={selectedAsset?.logo || ""}
                  isOtc={(selectedAsset?.market || "otc") === "otc"}
                  timeframe={timeframe}
                  candles={candles || []}
                  onOpenAssets={() => setShowAssetPanel(true)}
                  hasAlerts={priceAlerts.alerts.some((a) => a.symbol === selectedSymbol)}
                  onOpenAlerts={() => setSidePanel((cur) => (cur === "alerts" ? null : "alerts"))}
                />
              </div>
            </div>

            <TraderoomTradePanel
              amount={amount}
              maxAmount={currentBalance || 10000}
              onAmountChange={(val) => setAmount(Math.max(1, Math.min(currentBalance || 10000, val)))}
              onAmountStep={handleAmountChange}
              expirySeconds={expiryTime}
              canDecreaseExpiry={timeframeOptions.indexOf(expiryTime as Timeframe) > 0}
              canIncreaseExpiry={timeframeOptions.indexOf(expiryTime as Timeframe) < timeframeOptions.length - 1}
              onExpiryStep={handleExpiryChange}
              payout={payout}
              expectedReturn={expectedReturn}
              disabled={amount > currentBalance || entryBlocked}
              blockedReason={entryBlocked ? tradeWindow.reason : null}
              blockedHint={
                entryBlocked
                  ? marketClosed
                    ? nextOpenLabel
                      ? `Abre ${nextOpenLabel}`
                      : null
                    : "Escolha uma duração menor para operar agora"
                  : null
              }
              error={tradeError}
              onTrade={executeTrade}
              onHover={setHoverDirection}
            />
          </div>

          <TraderoomPortfolio
            open={portfolioOpen}
            onToggle={() => setPortfolioOpen((v) => !v)}
            positions={openPositions}
            payout={payout}
            nameFor={(sym) => assetBySymbol(sym)?.name || sym}
            onSelectAsset={() => setShowAssetPanel(true)}
            onSell={sellTrades}
          />
        </div>
      </div>

      {/* Mobile Bottom Controls (visible only on mobile) */}
      <div
        className="lg:hidden w-full border-t border-[#1a1a1e] shrink-0"
        style={{ backgroundColor: "#111111" }}
      >
        <div className="p-3 space-y-3">
          {/* Row 1: Time + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-[10px] mb-1 block font-medium uppercase tracking-wider">Horario</label>
              <div className="flex items-center justify-between p-2 rounded-xl" style={{ backgroundColor: "#1a1a1e" }}>
                <button
                  onClick={() => handleExpiryChange(-1)}
                  disabled={timeframeOptions.indexOf(expiryTime as Timeframe) === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-white/60" />
                </button>
                <span className="text-white text-sm font-bold">{TIMEFRAME_LABELS[expiryTime]}</span>
                <button
                  onClick={() => handleExpiryChange(1)}
                  disabled={
                    timeframeOptions.indexOf(expiryTime as Timeframe) === timeframeOptions.length - 1
                  }
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <label className="text-white/50 text-[10px] mt-2 mb-1 block font-medium uppercase tracking-wider">
                Tempo do grafico
              </label>
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: "#1a1a1e" }}>
                {timeframeOptions.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    aria-pressed={timeframe === tf}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      timeframe === tf
                        ? "bg-primary text-primary-foreground"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {TIMEFRAME_LABELS[tf]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-white/50 text-[10px] mb-1 block font-medium uppercase tracking-wider">Valor (R$)</label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAmountChange(-10)}
                  disabled={amount <= 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 shrink-0"
                  style={{ backgroundColor: "#1a1a1e" }}
                >
                  <Minus className="w-3.5 h-3.5 text-white/60" />
                </button>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    const val = Number.parseFloat(e.target.value) || 1
                    setAmount(Math.max(1, Math.min(currentBalance || 10000, val)))
                  }}
                  className="w-full h-8 px-2 rounded-lg text-center text-white text-sm font-bold bg-transparent border-0 outline-none"
                  style={{ backgroundColor: "#1a1a1e" }}
                  min="1"
                  max={currentBalance || 10000}
                />
                <button
                  onClick={() => handleAmountChange(10)}
                  disabled={amount >= currentBalance}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 shrink-0"
                  style={{ backgroundColor: "#1a1a1e" }}
                >
                  <Plus className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>
            </div>
          </div>

          {entryBlocked && (
            <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
              <Lock className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
              <p className="text-yellow-500 text-[11px] font-semibold">
                {tradeWindow.reason}
                {marketClosed && nextOpenLabel ? ` · Abre ${nextOpenLabel}` : ""}
              </p>
            </div>
          )}

          {/* Row 2: Return + Buttons */}
          <div className="flex items-center gap-3">
            <div className="text-center px-3 py-2 rounded-xl shrink-0" style={{ backgroundColor: "#1a1a1e" }}>
              <p className="text-white/50 text-[9px]">Retorno</p>
              <p className="text-[#26a69a] text-sm font-bold">+R$ {formatCurrency(expectedReturn)}</p>
              <p className="text-white/40 text-[9px]">+{payout}%</p>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <button
                onClick={() => executeTrade("PUT")}
                disabled={amount > currentBalance || entryBlocked}
                className="py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                }}
              >
                {entryBlocked ? <Lock className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>Vender</span>
              </button>
              <button
                onClick={() => executeTrade("CALL")}
                disabled={amount > currentBalance || entryBlocked}
                className="py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #00B35A 0%, #00E676 100%)",
                }}
              >
                {entryBlocked ? <Lock className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                <span>Comprar</span>
              </button>
            </div>
          </div>

          {tradeError && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1.5 text-red-400 text-[11px] text-center">
              {tradeError}
            </div>
          )}
        </div>
      </div>

      <TraderoomFooter />

      {/* Modals and Sidebars */}
      <SidebarMenu
        isOpen={showSidebar}
        onClose={handleCloseSidebar}
        balance={currentBalance}
        userName={user?.user_metadata?.name || user?.email?.split("@")[0]}
        onOpenTraderIA={handleOpenTraderIAFromMenu}
        userId={user?.id}
        historyRefresh={historyRefresh}
      />
      {showTraderIAModal && (
        <TraderIAModal
          isOpen={showTraderIAModal}
          onClose={() => setTraderIAModalOpen(false)}
          onActivate={() => {
            setIsTraderIAActive(true)
            setTraderIAModalOpen(false)
          }}
        />
      )}

      {/* Gaveta lateral de ativos (desktop) */}
      <AssetPanel
        open={showAssetPanel}
        assets={availableAssets}
        selectedSymbol={selectedSymbol}
        openTabs={openTabs}
        onSelect={setSelectedSymbol}
        onClose={handleCloseAssetPanel}
        clockTick={clockTick}
      />

      {/* Modal de ativos (mobile). No desktop quem responde e a gaveta lateral acima, por isso
          este bloco fica restrito ao breakpoint pequeno. */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 lg:hidden">
          <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: "#0e0e0e" }}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-white font-semibold text-lg">Selecionar Ativo</h3>
              <button
                onClick={() => setShowAssetModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar ativo..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-white text-sm outline-none"
                  style={{ backgroundColor: "#1a1a1e" }}
                />
              </div>

              {/* Abas de mercado: OTC x Mercado aberto */}
              <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ backgroundColor: "#1a1a1e" }}>
                {(
                  [
                    { id: "otc", label: "OTC" },
                    { id: "open", label: "Mercado aberto" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAssetMarketTab(tab.id)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      assetMarketTab === tab.id ? "bg-[#ff8a00] text-black" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-80">
                {filteredAssets.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8">Nenhum ativo nesta categoria.</p>
                )}
                {filteredAssets.map((asset) => {
                  // Status do mercado deste ativo. OTC e cripto estao sempre abertos; pares de
                  // mercado aberto so operam Seg-Sex das 8h as 18h (Brasilia). Quando fechado, o
                  // item nao pode ser selecionado e exibe o horario da proxima abertura.
                  const status = getMarketStatus(asset, new Date(clockTick))
                  const closed = !status.open
                  const openLabel = status.nextOpen
                    ? status.nextOpen.toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        weekday: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null
                  return (
                    <button
                      key={asset.symbol}
                      disabled={closed}
                      aria-disabled={closed}
                      onClick={() => {
                        if (closed) return
                        setSelectedSymbol(asset.symbol)
                        setShowAssetModal(false)
                        setAssetSearch("")
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                        closed
                          ? "cursor-not-allowed opacity-50"
                          : selectedSymbol === asset.symbol
                            ? "bg-[#26a69a]/20 border border-[#26a69a]/50"
                            : "hover:bg-[#222226]"
                      }`}
                      style={{
                        backgroundColor:
                          !closed && selectedSymbol === asset.symbol ? undefined : "#1a1a1e",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                          <Image
                            src={asset.logo || "/placeholder.svg"}
                            alt={asset.name}
                            width={40}
                            height={40}
                            className={`w-full h-full object-cover ${closed ? "grayscale" : ""}`}
                          />
                          {closed && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <Lock className="w-4 h-4 text-yellow-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-white font-semibold text-sm">{asset.name}</p>
                          {closed ? (
                            <p className="flex items-center gap-1 text-yellow-500 text-xs">
                              <Clock className="w-3 h-3 shrink-0" />
                              {openLabel ? `Abre ${openLabel}` : "Mercado fechado"}
                            </p>
                          ) : (
                            assetMarketTab === "otc" && <p className="text-gray-400 text-xs">Opção binária</p>
                          )}
                        </div>
                      </div>
                      {closed ? (
                        <span className="rounded-md bg-yellow-500/15 px-2 py-1 text-[11px] font-semibold text-yellow-500">
                          Fechado
                        </span>
                      ) : (
                        <span className="text-orange-500 font-semibold text-sm">{asset.payout}%</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animacao de resultado da operacao (estilo Avalon).
          O `key` e essencial: sem ele o React reaproveitaria a mesma instancia entre um resultado
          e o seguinte, e a animacao de entrada nao seria reexecutada — o card apenas trocaria de
          numero. Com o key, cada resultado da fila anima do inicio. */}
      {currentResult && (
        <TradeResultOverlay
          key={currentResult.key}
          type={currentResult.type}
          amount={currentResult.amount}
          durationMs={resultDurationMs}
        />
      )}
      <AnnouncementPopup />
    </div>
  )
}
