"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { MarketChart } from "@/components/trading/market-chart"
import { SidebarMenu } from "@/components/trading/sidebar-menu"
import { TraderIAModal } from "@/components/trading/trader-ia-modal"
import { TraderIAWatermark } from "@/components/trading/trader-ia-watermark"
import { TradeHistorySidebar } from "@/components/trading/trade-history-sidebar"
import { useGlobalOTC } from "@/lib/hooks/use-global-otc"
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
} from "lucide-react"
import { getMarketStatus } from "@/lib/market-hours"

interface ActiveTrade {
  id: string
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

const TIMEFRAMES = [60, 300, 600]
const TIMEFRAME_LABELS: Record<number, string> = {
  60: "1m",
  300: "5m",
  600: "10m",
}

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
  const [expiryTime, setExpiryTime] = useState<number>(60)
  const [timeframe, setTimeframe] = useState<number>(60) // Acompanha o tempo selecionado na corretora
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([])
  const [isTrading, setIsTrading] = useState(false)
  const [showSidebar, setSidebarOpen] = useState(false)
  const [tradeResult, setTradeResult] = useState<{ type: "win" | "loss"; amount: number } | null>(null)
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [accountType, setAccountType] = useState<"demo" | "real">("real")
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [amount, setAmount] = useState(10)
  const [showAssetModal, setShowAssetModal] = useState(false)
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

  // Trader sentiment (simulated)

  const { price, candles, isConnected, realReady } = useGlobalOTC(selectedSymbol, timeframe as 60 | 300 | 600)

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

  // Relógio que reavalia o horário de mercado periodicamente (para abrir/fechar sozinho).
  const [clockTick, setClockTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setClockTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // Status do mercado do ativo selecionado (fechado no fim de semana para forex de mercado aberto).
  const marketStatus = useMemo(
    () => getMarketStatus(selectedAsset, new Date(clockTick)),
    [selectedAsset, clockTick],
  )
  const marketClosed = !marketStatus.open
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
        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser()

        if (!mountedRef.current) return

        if (error || !currentUser) {
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
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && mountedRef.current) {
        router.replace("/auth/login")
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [router])

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
      const expiredTrades = pendingTrades.filter((t) => {
        const entryMs = new Date(t.entry_time).getTime()
        const expiryMs = (t.timeframe || 60) * 1000
        return now >= entryMs + expiryMs
      })

      if (expiredTrades.length === 0) return

      for (const trade of expiredTrades) {
        // Calcula um preco de saida realista em torno do preco de entrada (movimento aleatorio).
        // O resultado segue SEMPRE o preco real, para todos os usuarios (sem vitoria forcada).
        const move = (Math.random() - 0.5) * 0.01 // +/- 0.5%
        const exitPrice = trade.entry_price * (1 + move)
        const isWin =
          trade.direction === "CALL" ? exitPrice > trade.entry_price : exitPrice < trade.entry_price
        const result = isWin ? "win" : "loss"
        const profitAmount = isWin ? trade.amount * (trade.payout_percentage || 0.96) : -trade.amount

        await supabase
          .from("trades")
          .update({
            result,
            profit: profitAmount,
            exit_price: exitPrice,
            exit_time: new Date().toISOString(),
          })
          .eq("id", trade.id)

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

  // Track processed trade IDs to prevent double-processing
  const processedTradesRef = useRef<Set<string>>(new Set())

  // Check active trades results - ROBUST
  useEffect(() => {
    if (activeTrades.length === 0 || !user || !mountedRef.current) return

    const checkTradeResults = async () => {
      if (!mountedRef.current) return

      const now = Date.now()
      const tradesToFinalize: ActiveTrade[] = []

      for (const trade of activeTrades) {
        if (!mountedRef.current) break
        const expiresAt = trade.timestamp + trade.expiryTime * 1000

        if (now >= expiresAt && price > 0) {
          // Skip if already being processed
          if (processedTradesRef.current.has(trade.id)) continue
          tradesToFinalize.push(trade)
        }
      }

      for (const trade of tradesToFinalize) {
        if (!mountedRef.current) break

        // Mark as being processed to prevent race conditions
        processedTradesRef.current.add(trade.id)

        try {
          // Resultado REAL baseado no movimento do preco, para TODOS os usuarios
          // (sem vitoria forcada para demo nem para afiliado)
          const isWin =
            trade.direction === "CALL" ? price > trade.entryPrice : price < trade.entryPrice
          const result = isWin ? "win" : "loss"
          const profitAmount = isWin ? Math.round(trade.amount * (payout / 100) * 100) / 100 : 0

          // Find the pending trade - robust query by user + symbol + pending + is_demo
          const { data: pendingTrades, error: fetchError } = await supabaseRef.current
            .from("trades")
            .select("id, result")
            .eq("user_id", user.id)
            .eq("symbol", trade.symbol)
            .eq("is_demo", trade.isDemo)
            .in("result", ["pending", "PENDING"])
            .order("created_at", { ascending: false })
            .limit(1)

          const existingTrade = pendingTrades?.[0]

          if (fetchError || !existingTrade) {
            // Trade not found in DB - remove from active list to prevent zombie
            setActiveTrades((prev) => prev.filter((t) => t.id !== trade.id))
            continue
          }

          // Already processed by another path
          if (existingTrade.result !== "pending" && existingTrade.result !== "PENDING") {
            setActiveTrades((prev) => prev.filter((t) => t.id !== trade.id))
            continue
          }

          // Update trade in DB
          const { error: updateError } = await supabaseRef.current
            .from("trades")
            .update({
              exit_price: price,
              exit_time: new Date().toISOString(),
              result,
              profit: isWin ? profitAmount : -trade.amount,
            })
            .eq("id", existingTrade.id)

          if (updateError) {
            processedTradesRef.current.delete(trade.id)
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
            setTradeResult({ type: result, amount: isWin ? profitAmount : trade.amount })
            setActiveTrades((prev) => prev.filter((t) => t.id !== trade.id))
            setHistoryRefresh((prev) => prev + 1)

            // Play win/loss sound
            if (isWin) playWinSound()
            else playLossSound()

            setTimeout(() => {
              if (mountedRef.current) setTradeResult(null)
            }, 3000)
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
  }, [activeTrades, price, user, payout])

  const executeTrade = useCallback(
    async (direction: "CALL" | "PUT") => {
      if (isTrading || !user) {
        return
      }

      // Bloqueia entradas quando o mercado do ativo está fechado (ex.: forex no fim de semana).
      if (!marketStatus.open) {
        setTradeError(marketStatus.reason || "Mercado fechado")
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

      const entryPrice = price > 0 ? price : 1.085 // fallback price

      // Toca o som AQUI (sincrono, ainda dentro do gesto de clique do usuario).
      // Se tocado apos os awaits abaixo, o navegador ja perdeu o contexto do gesto e
      // o AudioContext fica suspenso (sem som), principalmente no mobile.
      if (direction === "CALL") playCallSound()
      else playPutSound()

      setIsTrading(true)
      setTradeError(null)

      try {
        const tradeId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const entryTime = new Date()
        const expiryTimeDate = new Date(Date.now() + expiryTime * 1000)
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

        const { error: insertError } = await supabaseRef.current.from("trades").insert(tradeData)

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
          symbol: selectedSymbol,
          direction: direction, // UPPERCASE
          amount,
          entryPrice: entryPrice,
          expiryTime: expiryTime,
          timestamp: Date.now(),
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
    [user, amount, currentBalance, selectedSymbol, price, expiryTime, accountType, payout, isTrading, marketStatus],
  )

  const handleExpiryChange = useCallback(
    (delta: number) => {
      const currentIndex = TIMEFRAMES.indexOf(expiryTime)
      const newIndex = Math.max(0, Math.min(TIMEFRAMES.length - 1, currentIndex + delta))
      const newExpiry = TIMEFRAMES[newIndex]
      setExpiryTime(newExpiry)
    },
    [expiryTime],
  )

  const handleAmountChange = useCallback(
    (delta: number) => {
      setAmount((prev) => Math.max(1, Math.min(currentBalance || 10000, prev + delta)))
    },
    [currentBalance],
  )

  const [isDesktop, setIsDesktop] = useState(false)

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0e0e0e" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col lg:grid lg:grid-cols-[1fr_340px] overflow-hidden" style={{ backgroundColor: "#0e0e0e" }}>
      {/* LEFT COLUMN: Header + Chart */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <header className="flex items-center gap-2 px-2 lg:px-5 py-1.5 lg:py-2.5 border-b border-white/[0.06] shrink-0" style={{ backgroundColor: "#111114" }}>
          {/* Left - Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-200 active:scale-95 shrink-0"
          >
            <MoreVertical className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
          </button>

          {/* Center (MOBILE) - Seletor simples de ativo, abre o modal */}
          <button
            onClick={() => setShowAssetModal(true)}
            className="flex lg:hidden items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] transition-all duration-200 border border-white/[0.06] min-w-0 flex-1"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-700 shrink-0 ring-2 ring-white/10">
              <Image
                src={selectedAsset?.logo || "/placeholder.svg"}
                alt={selectedAsset?.name || "Asset"}
                width={28}
                height={28}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left min-w-0">
              <p className="text-white font-bold text-xs leading-tight truncate">
                {selectedAsset?.name || "Selecionar"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[#26a69a] text-[10px] font-mono font-semibold">
                  {price > 0 ? formatFixed(price, selectedAsset?.symbol?.includes("JPY") ? 3 : 5) : "..."}
                </span>
                <span className="text-[9px] px-1 py-[1px] bg-[#26a69a]/15 text-[#26a69a] rounded font-bold">
                  {payout}%
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          </button>

          {/* Center (DESKTOP) - Barra de abas de ativos (estilo IQ Option) */}
          <div className="hidden lg:flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto scrollbar-hide">
            {/* Botao de grade - abre a lista de todos os ativos */}
            <button
              onClick={() => setShowAssetModal(true)}
              aria-label="Todos os ativos"
              className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-200 active:scale-95 shrink-0"
            >
              <LayoutGrid className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
            </button>

            {/* Abas abertas */}
            {openTabs.map((sym) => {
              const asset = assetBySymbol(sym)
              if (!asset) return null
              const isActive = sym === selectedSymbol
              return (
                <div
                  key={sym}
                  onClick={() => setSelectedSymbol(sym)}
                  role="button"
                  tabIndex={0}
                  className={`group relative flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-lg cursor-pointer shrink-0 border transition-all duration-200 ${
                    isActive
                      ? "bg-white/[0.06] border-white/[0.1]"
                      : "bg-transparent border-transparent hover:bg-white/[0.03]"
                  }`}
                >
                  {/* Botao fechar (X) no canto superior esquerdo */}
                  {openTabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(sym)
                      }}
                      aria-label={`Fechar ${asset.name}`}
                      className="absolute top-1 left-1 w-4 h-4 rounded-sm flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}

                  <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full overflow-hidden bg-gray-700 shrink-0 ring-1 ring-white/10">
                    <Image
                      src={asset.logo || "/placeholder.svg"}
                      alt={asset.name}
                      width={28}
                      height={28}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-white font-bold text-xs lg:text-sm leading-tight truncate max-w-[90px] lg:max-w-[110px]">
                      {asset.name}
                    </p>
                    <p className="text-gray-500 text-[10px] leading-tight">Binária</p>
                  </div>

                  {/* Sublinhado laranja na aba ativa */}
                  {isActive && (
                    <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-[#ff8a00] rounded-full" />
                  )}
                </div>
              )
            })}

            {/* Botao adicionar nova aba */}
            <button
              onClick={() => setShowAssetModal(true)}
              aria-label="Adicionar ativo"
              className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-200 active:scale-95 shrink-0 border border-white/[0.06]"
            >
              <Plus className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
            </button>
          </div>

          {/* Right - Balance & Wallet */}
          <div className="flex items-center gap-1.5 lg:gap-2 shrink-0 ml-auto">
            <div className="flex flex-col items-end relative">
              <span className="text-white text-xs lg:text-lg font-bold leading-tight tracking-tight whitespace-nowrap">
                R$ {formatCurrency(currentBalance)}
              </span>
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center gap-0.5 text-[10px] lg:text-xs hover:text-white transition-colors mt-0.5"
              >
                <span className={accountType === "demo" ? "text-amber-400" : "text-[#26a69a]"}>
                  {accountType === "demo" ? "Demo" : "Real"}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>

              {showAccountDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountDropdown(false)} />
                  <div
                    className="absolute top-full right-0 mt-2 w-40 rounded-xl shadow-2xl z-50 overflow-hidden border border-white/[0.08]"
                    style={{ backgroundColor: "#18181c" }}
                  >
                    <button
                      onClick={() => {
                        setAccountType("real")
                        setShowAccountDropdown(false)
                      }}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition flex items-center gap-2.5 ${
                        accountType === "real" ? "text-[#26a69a]" : "text-gray-300"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${accountType === "real" ? "bg-[#26a69a]" : "bg-gray-600"}`}
                      />
                      Conta Real
                    </button>
                    <div className="border-t border-white/[0.06]" />
                    <button
                      onClick={() => {
                        setAccountType("demo")
                        setShowAccountDropdown(false)
                      }}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition flex items-center gap-2.5 ${
                        accountType === "demo" ? "text-amber-400" : "text-gray-300"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${accountType === "demo" ? "bg-amber-400" : "bg-gray-600"}`}
                      />
                      Conta Demo
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Wallet Button */}
            <button
              onClick={() => (window.location.href = "/deposit")}
              className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center bg-[#9333ea] hover:bg-[#a855f7] transition-all duration-200 shadow-lg shadow-[#9333ea]/20 active:scale-95 shrink-0"
            >
              <Wallet className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </button>
          </div>
        </header>

        {/* Chart Area - Candlestick chart with native trade lines + 24h history */}
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0">
            {isTraderIAActive && <TraderIAWatermark />}
            <MarketChart
              candles={candles || []}
              currentPrice={price || 0}
              activeTrades={activeTradesForChart}
              timeframe={timeframe as 60 | 300 | 600}
              symbol={selectedSymbol}
              payout={payout / 100}
              result={tradeResult}
              reloadKey={realReady ? 1 : 0}
            />
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Trading Controls (Desktop only) */}
      <div
        className="hidden lg:flex flex-col border-l border-[#1a1a1e] min-h-0"
        style={{ backgroundColor: "#111111" }}
      >
        <div className="p-4 xl:p-5 space-y-4 shrink-0">
          {/* Expiry Time */}
          <div>
            <label className="text-white/50 text-[11px] mb-2 block font-medium uppercase tracking-wider">Horario</label>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "#1a1a1e" }}>
              <button
                onClick={() => handleExpiryChange(-1)}
                disabled={TIMEFRAMES.indexOf(expiryTime) === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white/60" />
              </button>
              <span className="text-white text-lg font-bold">{TIMEFRAME_LABELS[expiryTime]}</span>
              <button
                onClick={() => handleExpiryChange(1)}
                disabled={TIMEFRAMES.indexOf(expiryTime) === TIMEFRAMES.length - 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white/60" />
              </button>
            </div>
          </div>

          {/* Tempo de expiração do gráfico - abas estilo corretora */}
          <div>
            <label className="text-white/50 text-[11px] mb-2 block font-medium uppercase tracking-wider">
              Tempo do grafico
            </label>
            <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ backgroundColor: "#1a1a1e" }}>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  aria-pressed={timeframe === tf}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
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

          {/* Amount */}
          <div>
            <label className="text-white/50 text-[11px] mb-2 block font-medium uppercase tracking-wider">Valor (R$)</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAmountChange(-10)}
                disabled={amount <= 1}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                style={{ backgroundColor: "#1a1a1e" }}
              >
                <Minus className="w-4 h-4 text-white/60" />
              </button>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  const val = Number.parseFloat(e.target.value) || 1
                  setAmount(Math.max(1, Math.min(currentBalance || 10000, val)))
                }}
                className="w-full h-10 px-3 rounded-xl text-center text-white text-base font-bold bg-transparent border-0 outline-none"
                style={{ backgroundColor: "#1a1a1e" }}
                min="1"
                max={currentBalance || 10000}
              />
              <button
                onClick={() => handleAmountChange(10)}
                disabled={amount >= currentBalance}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                style={{ backgroundColor: "#1a1a1e" }}
              >
                <Plus className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>

          {/* Expected Return */}
          <div className="text-center p-3 rounded-xl" style={{ backgroundColor: "#1a1a1e" }}>
            <p className="text-white/50 text-[11px] mb-0.5">Retorno</p>
            <p className="text-[#26a69a] text-lg font-bold">+R$ {formatCurrency(expectedReturn)}</p>
            <p className="text-white/40 text-xs">+{payout}%</p>
          </div>

          {/* Aviso de mercado fechado */}
          {marketClosed && (
            <div className="flex items-start gap-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5">
              <Lock className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-yellow-500 text-xs font-semibold">{marketStatus.reason}</p>
                {nextOpenLabel && (
                  <p className="text-yellow-500/70 text-[11px] mt-0.5">Abre {nextOpenLabel}</p>
                )}
              </div>
            </div>
          )}

          {/* Trading Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => executeTrade("CALL")}
              disabled={amount > currentBalance || marketClosed}
              className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #00B35A 0%, #00E676 100%)",
              }}
            >
              {marketClosed ? <Lock className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
              <span>Comprar</span>
            </button>

            <button
              onClick={() => executeTrade("PUT")}
              disabled={amount > currentBalance || marketClosed}
              className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
              }}
            >
              {marketClosed ? <Lock className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span>Vender</span>
            </button>
          </div>

          {tradeError && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs text-center">
              {tradeError}
            </div>
          )}
        </div>

        {/* History below buttons */}
        <div className="flex-1 min-h-0 overflow-hidden border-t border-[#1a1a1e]">
          <TradeHistorySidebar
            userId={user?.id || ""}
            refreshTrigger={historyRefresh}
            isDemo={accountType === "demo"}
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
                  disabled={TIMEFRAMES.indexOf(expiryTime) === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-white/60" />
                </button>
                <span className="text-white text-sm font-bold">{TIMEFRAME_LABELS[expiryTime]}</span>
                <button
                  onClick={() => handleExpiryChange(1)}
                  disabled={TIMEFRAMES.indexOf(expiryTime) === TIMEFRAMES.length - 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <label className="text-white/50 text-[10px] mt-2 mb-1 block font-medium uppercase tracking-wider">
                Tempo do grafico
              </label>
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: "#1a1a1e" }}>
                {TIMEFRAMES.map((tf) => (
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

          {marketClosed && (
            <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
              <Lock className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
              <p className="text-yellow-500 text-[11px] font-semibold">
                {marketStatus.reason}
                {nextOpenLabel ? ` · Abre ${nextOpenLabel}` : ""}
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
                disabled={amount > currentBalance || marketClosed}
                className="py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                }}
              >
                {marketClosed ? <Lock className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>Vender</span>
              </button>
              <button
                onClick={() => executeTrade("CALL")}
                disabled={amount > currentBalance || marketClosed}
                className="py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #00B35A 0%, #00E676 100%)",
                }}
              >
                {marketClosed ? <Lock className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
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

      {/* Modals and Sidebars */}
      <SidebarMenu
        isOpen={showSidebar}
        onClose={() => setSidebarOpen(false)}
        balance={currentBalance}
        userName={user?.user_metadata?.name || user?.email?.split("@")[0]}
        onOpenTraderIA={() => {
          setSidebarOpen(false)
          setTraderIAModalOpen(true)
        }}
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

      {/* Asset Selection Modal */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    onClick={() => {
                      setSelectedSymbol(asset.symbol)
                      setShowAssetModal(false)
                      setAssetSearch("")
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      selectedSymbol === asset.symbol ? "bg-[#26a69a]/20 border border-[#26a69a]/50" : ""
                    }`}
                    style={{ backgroundColor: selectedSymbol === asset.symbol ? undefined : "#1a1a1e" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                        <Image
                          src={asset.logo || "/placeholder.svg"}
                          alt={asset.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold text-sm">{asset.name}</p>
                        {assetMarketTab === "otc" && <p className="text-gray-400 text-xs">Opção binária</p>}
                      </div>
                    </div>
                    <span className="text-purple-500 font-semibold text-sm">{asset.payout}%</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade Result Notification */}
      {tradeResult && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-pulse">
          <div
            className={`px-6 py-3 rounded-xl font-bold text-white shadow-2xl ${
              tradeResult.type === "win" ? "bg-purple-500" : "bg-red-500"
            }`}
          >
            {tradeResult.type === "win"
              ? `+R$ ${formatCurrency(tradeResult.amount)}`
              : `-R$ ${formatCurrency(tradeResult.amount)}`}
          </div>
        </div>
      )}
    </div>
  )
}
