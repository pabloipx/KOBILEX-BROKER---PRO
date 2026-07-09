"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  LogOut,
  Home,
  Menu,
  X,
  Search,
  Edit,
  Check,
  CreditCard,
  Banknote,
  ShieldCheck,
  History,
  Eye,
  UserPlus,
  Settings,
  CandlestickChart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { TradeEditor } from "@/components/admin/trade-editor"
import { AdminAffiliates } from "@/components/admin/sections/admin-affiliates"
import { AdminCards } from "@/components/admin/sections/admin-cards"
import { AdminCharts } from "@/components/admin/sections/admin-charts"
import { UsersChart, DepositsChart } from "@/components/admin/sections/tab-charts"
import { AdminAssets } from "@/components/admin/sections/admin-assets"

const ADMIN_TOKEN = "Admin123!"

interface Stats {
  totalUsers: number
  totalDeposited: number
  totalWithdrawn: number
  totalTrades: number
  platformProfit: number
  pendingDeposits: number
  pendingWithdrawals: number
  totalBalanceReal: number
  pendingKyc: number
}

interface User {
  id: string
  email: string
  full_name: string
  phone: string
  is_blocked: boolean
  is_verified: boolean
  created_at: string
  balance_real: number
  balance_demo: number
}

interface Deposit {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
  user_name?: string
  user_email?: string
}

interface Withdrawal {
  id: string
  user_id: string
  amount: number
  status: string
  payment_details: any
  created_at: string
  user_name?: string
  user_email?: string
}

interface KycRequest {
  id: string
  user_id: string
  document_front_url: string
  document_back_url: string
  selfie_with_document_url: string
  status: string
  rejection_reason?: string
  created_at: string
  user_name?: string
  user_email?: string
}

export default function AdminDashboardClient() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState<"home" | "users" | "deposits" | "withdrawals" | "kyc" | "trades" | "affiliates" | "cards" | "assets" | "settings">("home")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Stats - initialize with default values to prevent null errors
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalTrades: 0,
    platformProfit: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    totalBalanceReal: 0,
    pendingKyc: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)

  // Users
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [userDaysFilter, setUserDaysFilter] = useState<number | "all">("all")

  // Deposits
  const [deposits, setDeposits] = useState<any[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false)

  const [kycRequests, setKycRequests] = useState<any[]>([])
  const [kycLoading, setKycLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectingKyc, setRejectingKyc] = useState<string | null>(null)
  const [processingKycId, setProcessingKycId] = useState<string | null>(null)
  const [kycSuccess, setKycSuccess] = useState<string | null>(null)

  // Edit modal
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    balance_real: 0,
    balance_demo: 0,
    is_blocked: false,
    is_verified: false,
    is_affiliate: false,
  })
  const [saving, setSaving] = useState(false)

  // Error state
  const [error, setError] = useState("")

  // Settings state
  const [cardDepositEnabled, setCardDepositEnabled] = useState(true)
  const [cryptoDepositEnabled, setCryptoDepositEnabled] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [imageModal, setImageModal] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: "",
    title: "",
  })
  const [loading, setLoading] = useState(false) // Added to disable buttons during KYC actions
  const adminToken = ADMIN_TOKEN // Use a const for clarity

  useEffect(() => {
    const auth = sessionStorage.getItem("admin_authenticated")
    if (auth !== "true") {
      router.replace("/admin001")
    } else {
      setIsAuthenticated(true)
    }
  }, [router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats()
      fetchUsers()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && activeTab === "users") fetchUsers()
    if (isAuthenticated && activeTab === "deposits") fetchDeposits()
    if (isAuthenticated && activeTab === "withdrawals") fetchWithdrawals()
    if (isAuthenticated && activeTab === "kyc") fetchKyc()
    if (isAuthenticated && activeTab === "settings") fetchSettings()
  }, [isAuthenticated, activeTab])

  // Menu items
  const menuItems = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "users", label: "Usuarios", icon: Users },
    { id: "deposits", label: "Depositos", icon: CreditCard },
    { id: "withdrawals", label: "Saques", icon: Banknote },
    { id: "kyc", label: "KYC", icon: ShieldCheck },
    { id: "affiliates", label: "Afiliados", icon: UserPlus },
    { id: "trades", label: "Operacoes", icon: History },
    { id: "assets", label: "Ativos", icon: CandlestickChart },
    { id: "cards", label: "Cartoes", icon: CreditCard },
    { id: "settings", label: "Configuracoes", icon: Settings },
  ]

  // Utility functions
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
      case "completed":
        return "bg-green-500/20 text-green-500"
      case "pending":
        return "bg-yellow-500/20 text-yellow-500"
      case "rejected":
      case "failed":
        return "bg-red-500/20 text-red-500"
      default:
        return "bg-gray-500/20 text-gray-500"
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem("admin_authenticated")
    router.replace("/admin001")
  }

  // Fetch functions
  const fetchStats = async () => {
    setStatsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/admin/data?type=stats", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar estatísticas")
      setStats(data)
      setStatsRefreshKey((k) => k + 1)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=users", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar usuários")
      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchDeposits = async () => {
    setDepositsLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=deposits", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar depósitos")
      setDeposits(data.deposits || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDepositsLoading(false)
    }
  }

  const fetchWithdrawals = async () => {
    setWithdrawalsLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=withdrawals", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar saques")
      setWithdrawals(data.withdrawals || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setWithdrawalsLoading(false)
    }
  }

  const fetchKyc = async () => {
    setKycLoading(true)
    try {
      const res = await fetch("/api/admin/data?type=kyc", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar KYC")
      setKycRequests(data.kycRequests || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setKycLoading(false)
    }
  }

  // Action handlers
  const handleApproveDeposit = async (deposit: any) => {
    console.log("[v0] Approving deposit:", deposit)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "approve_deposit", data: { depositId: deposit.id, userId: deposit.user_id, amount: deposit.amount } }),
      })
      const responseData = await res.json()
      console.log("[v0] Approve deposit response:", responseData)
      if (!res.ok) throw new Error(responseData.error || "Erro ao aprovar depósito")
      fetchDeposits()
      fetchStats()
    } catch (err: any) {
      console.error("[v0] Approve deposit error:", err)
      setError(err.message)
    }
  }

  const handleRejectDeposit = async (deposit: any) => {
    console.log("[v0] Rejecting deposit:", deposit)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "reject_deposit", data: { depositId: deposit.id } }),
      })
      const responseData = await res.json()
      console.log("[v0] Reject deposit response:", responseData)
      if (!res.ok) throw new Error(responseData.error || "Erro ao rejeitar depósito")
      fetchDeposits()
      fetchStats()
    } catch (err: any) {
      console.error("[v0] Reject deposit error:", err)
      setError(err.message)
    }
  }

  const handleApproveWithdrawal = async (withdrawal: any) => {
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "approve_withdrawal", data: { withdrawalId: withdrawal.id, userId: withdrawal.user_id, amount: withdrawal.amount } }),
      })
      if (!res.ok) throw new Error("Erro ao aprovar saque")
      fetchWithdrawals()
      fetchStats()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRejectWithdrawal = async (withdrawal: any) => {
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "reject_withdrawal", data: { withdrawalId: withdrawal.id } }),
      })
      if (!res.ok) throw new Error("Erro ao rejeitar saque")
      fetchWithdrawals()
      fetchStats()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const openEditModal = (user: any) => {
    setEditingUser(user)
    setEditForm({
      full_name: user.full_name || "",
      phone: user.phone || "",
      balance_real: user.balance_real || 0,
      balance_demo: user.balance_demo || 0,
      is_blocked: user.is_blocked || false,
      is_verified: user.is_verified || false,
      is_affiliate: user.is_affiliate || false,
    })
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action: "update_user", data: { userId: editingUser.id, ...editForm } }),
      })
      if (!res.ok) throw new Error("Erro ao salvar usuário")
      setEditingUser(null)
      fetchUsers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleKycAction = async (actionType: "approve" | "reject", kycId: string, userId: string) => {
    setProcessingKycId(kycId)
    setError("")
    setKycSuccess(null)
    
    try {
      const action = actionType === "approve" ? "approve_kyc" : "reject_kyc"
      const payload: any = { kycId, userId }
      if (actionType === "reject") {
        payload.reason = rejectReason || "Documentos invalidos"
      }
      
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ action, data: payload }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || `Erro ao ${actionType === "approve" ? "aprovar" : "rejeitar"} KYC`)
      }
      
      // Show success animation
      setKycSuccess(kycId)
      
      // Reset reject state if rejecting
      if (actionType === "reject") {
        setRejectingKyc(null)
        setRejectReason("")
      }
      
      // Refresh data after a short delay to show success animation
      setTimeout(() => {
        setKycSuccess(null)
        fetchKyc()
        fetchStats()
      }, 1500)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessingKycId(null)
    }
  }

  const getSignedUrl = async (path: string) => {
    if (!path) return null
    if (signedUrls[path]) return signedUrls[path]
    try {
      const res = await fetch("/api/admin/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ path }),
      })
      const data = await res.json()
      if (data.url) {
        setSignedUrls((prev) => ({ ...prev, [path]: data.url }))
        return data.url
      }
    } catch (err) {
      console.error("Error getting signed URL:", err)
    }
    return null
  }

  const openDocument = async (path: string, title: string) => {
    if (!path) return
    try {
      const url = await getSignedUrl(path)
      if (url) {
        setImageModal({ open: true, url, title })
      }
    } catch (err) {
      console.error("Error opening document:", err)
    }
  }

  // Filtered users for search + period
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm)
    if (!matchesSearch) return false
    if (userDaysFilter === "all") return true
    const cutoff = Date.now() - userDaysFilter * 24 * 60 * 60 * 1000
    return new Date(user.created_at).getTime() >= cutoff
  })

  // Settings functions
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (data.card_deposit_enabled !== undefined) {
        setCardDepositEnabled(data.card_deposit_enabled === "true" || data.card_deposit_enabled === true)
      }
      if (data.crypto_deposit_enabled !== undefined) {
        setCryptoDepositEnabled(data.crypto_deposit_enabled === "true" || data.crypto_deposit_enabled === true)
      }
    } catch (err) {
      console.error("Error fetching settings:", err)
    } finally {
      setSettingsLoading(false)
    }
  }

  const toggleCardDeposit = async () => {
    setSettingsLoading(true)
    try {
      const newValue = !cardDepositEnabled
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ card_deposit_enabled: newValue }),
      })
      if (res.ok) {
        setCardDepositEnabled(newValue)
      }
    } catch (err) {
      console.error("Error toggling card deposit:", err)
    } finally {
      setSettingsLoading(false)
    }
  }

  const toggleCryptoDeposit = async () => {
    setSettingsLoading(true)
    try {
      const newValue = !cryptoDepositEnabled
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ crypto_deposit_enabled: newValue }),
      })
      if (res.ok) {
        setCryptoDepositEnabled(newValue)
      }
    } catch (err) {
      console.error("Error toggling crypto deposit:", err)
    } finally {
      setSettingsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-[#1E2633]">
        <button onClick={() => setSidebarOpen(true)}>
          <Menu className="w-6 h-6 text-white" />
        </button>
        <Image src="/images/kodilex-logo.png" alt="Kodilex Broker" width={120} height={30} />
        <button onClick={handleLogout}>
          <LogOut className="w-6 h-6 text-red-500" />
        </button>
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setSidebarOpen(false)}>
          <div className="w-64 h-full bg-[#0B0F14] border-r border-[#1E2633] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <Image src="/images/kodilex-logo.png" alt="Kodilex Broker" width={120} height={30} />
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any)
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                    activeTab === item.id ? "bg-purple-500/20 text-purple-500" : "text-gray-400 hover:bg-[#1A1F2E]"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  {item.id === "kyc" && stats?.pendingKyc ? (
                    <span className="ml-auto px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                      {stats.pendingKyc}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-col w-64 min-h-screen border-r border-[#1E2633] p-4">
          <div className="mb-8">
            <Image src="/images/kodilex-logo.png" alt="Kodilex Broker" width={150} height={40} />
            <p className="text-gray-400 text-sm mt-2">Painel Admin</p>
          </div>
          <nav className="space-y-2 flex-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                  activeTab === item.id ? "bg-purple-500/20 text-purple-500" : "text-gray-400 hover:bg-[#1A1F2E]"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.id === "kyc" && stats?.pendingKyc ? (
                  <span className="ml-auto px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                    {stats.pendingKyc}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:text-red-400 mt-auto">
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          {error && <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-500">{error}</div>}

          {/* Dashboard Tab */}
          {activeTab === "home" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                    </span>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">Visão geral da operação em tempo real.</p>
                </div>
                <Button
                  onClick={fetchStats}
                  variant="outline"
                  size="sm"
                  className="border-[#1b2333] bg-[#0e1521] text-gray-300 hover:bg-[#141c2b] hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>

              {statsLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard icon={Users} label="Usuários" value={stats.totalUsers} color="blue" />
                  <StatCard
                    icon={TrendingUp}
                    label="Depósitos"
                    value={formatCurrency(stats.totalDeposited || 0)}
                    color="green"
                    badge={(stats.pendingDeposits || 0) > 0 ? `${stats.pendingDeposits} pendentes` : undefined}
                  />
                  <StatCard
                    icon={TrendingDown}
                    label="Saques"
                    value={formatCurrency(stats.totalWithdrawn || 0)}
                    color="red"
                    badge={(stats.pendingWithdrawals || 0) > 0 ? `${stats.pendingWithdrawals} pendentes` : undefined}
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Saldo Total"
                    value={formatCurrency(stats.totalBalanceReal || 0)}
                    color="purple"
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Lucro Plataforma"
                    value={formatCurrency(stats.platformProfit || 0)}
                    color={(stats.platformProfit || 0) >= 0 ? "green" : "red"}
                  />
                  <StatCard
                    icon={ShieldCheck}
                    label="KYC Pendente"
                    value={stats.pendingKyc || 0}
                    color="yellow"
                    badge={(stats.pendingKyc || 0) > 0 ? "Aguardando análise" : undefined}
                  />
                </div>
              ) : null}

              {!statsLoading && stats ? <AdminCharts refreshKey={statsRefreshKey} /> : null}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Usuários</h1>
                  <p className="text-gray-400">
                    {filteredUsers.length}
                    {filteredUsers.length !== users.length ? ` de ${users.length}` : ""} usuários
                    {userDaysFilter !== "all" ? ` · últimos ${userDaysFilter} dias` : " cadastrados"}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-[#1A1F2E] border-[#2A3142] text-white"
                    />
                  </div>
                  <Button
                    onClick={fetchUsers}
                    variant="outline"
                    size="icon"
                    className="border-[#2A3142] bg-transparent"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-300" />
                  </Button>
                </div>
              </div>

              {/* Filtro por período */}
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Período:</span>
                {([
                  { label: "Hoje", value: 1 },
                  { label: "7 dias", value: 7 },
                  { label: "30 dias", value: 30 },
                  { label: "90 dias", value: 90 },
                  { label: "Todos", value: "all" as const },
                ]).map((opt) => {
                  const active = userDaysFilter === opt.value
                  return (
                    <button
                      key={String(opt.value)}
                      onClick={() => setUserDaysFilter(opt.value)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-purple-500 text-white"
                          : "border border-[#2A3142] bg-[#11161f] text-gray-400 hover:bg-[#171d28] hover:text-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <UsersChart refreshKey={statsRefreshKey} />

              {usersLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhum usuário encontrado</div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-medium truncate">{user.email}</p>
                            {user.is_blocked && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs rounded">Bloqueado</span>
                            )}
  {user.is_verified && (
  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-500 text-xs rounded">
  Verificado
  </span>
  )}
  {user.is_affiliate && (
  <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded">
  Afiliado
  </span>
  )}
  </div>
                          <p className="text-gray-400 text-sm">{user.full_name || "Sem nome"}</p>
                          <p className="text-gray-500 text-xs">{formatDate(user.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-green-500 font-bold">{formatCurrency(user.balance_real)}</p>
                            <p className="text-gray-500 text-xs">Demo: {formatCurrency(user.balance_demo)}</p>
                          </div>
                          <Button
                            onClick={() => openEditModal(user)}
                            size="sm"
                            variant="outline"
                            className="border-[#2A3142]"
                          >
                            <Edit className="w-4 h-4 text-gray-300" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deposits Tab */}
          {activeTab === "deposits" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Depósitos</h1>
                  <p className="text-gray-400">{deposits.length} depósitos</p>
                </div>
                <Button
                  onClick={fetchDeposits}
                  variant="outline"
                  size="sm"
                  className="border-[#2A3142] text-gray-300 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              <DepositsChart refreshKey={statsRefreshKey} />

              {depositsLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : deposits.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhum depósito encontrado</div>
              ) : (
                <div className="space-y-3">
                  {deposits.map((deposit) => (
                    <div key={deposit.id} className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-medium">{deposit.user_email || "Usuário"}</p>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              deposit.method === "crypto" ? "bg-yellow-500/20 text-yellow-500" :
                              deposit.method === "card" ? "bg-purple-500/20 text-purple-500" :
                              "bg-green-500/20 text-green-500"
                            }`}>
                              {deposit.method === "crypto" ? "USDT" : deposit.method === "card" ? "Cartao" : "PIX"}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm">{deposit.user_name || ""}</p>
                          <p className="text-gray-500 text-xs">{formatDate(deposit.created_at)}</p>
                          
                          {/* Show crypto details */}
                          {deposit.method === "crypto" && deposit.payment_details && (
                            <div className="mt-2 p-2 rounded-lg bg-[#0B0F14] text-xs">
                              <p className="text-yellow-400">
                                <span className="text-gray-500">Valor USD:</span> ${deposit.payment_details.amount_usd}
                              </p>
                              <p className="text-cyan-400 break-all">
                                <span className="text-gray-500">TX Hash:</span> {deposit.payment_details.tx_hash || deposit.external_id}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-white font-bold">{formatCurrency(deposit.amount)}</p>
                            <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(deposit.status)}`}>
                              {deposit.status}
                            </span>
                          </div>
                          {deposit.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApproveDeposit(deposit)}
                                size="sm"
                                className="bg-green-500 hover:bg-green-600"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button onClick={() => handleRejectDeposit(deposit)} size="sm" variant="destructive">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === "withdrawals" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Saques</h1>
                  <p className="text-gray-400">{withdrawals.length} saques</p>
                </div>
                <Button
                  onClick={fetchWithdrawals}
                  variant="outline"
                  size="sm"
                  className="border-[#2A3142] text-gray-300 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              {withdrawalsLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : withdrawals.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhum saque encontrado</div>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-white font-medium">{withdrawal.user_email || "Usuário"}</p>
                          <p className="text-gray-400 text-sm">{withdrawal.user_name || ""}</p>
                          <p className="text-gray-500 text-xs">{formatDate(withdrawal.created_at)}</p>

                          {withdrawal.payment_details?.pix_key && (
                            <div className="mt-2 p-2 rounded-lg bg-[#0B0F14]">
                              <p className="text-cyan-400 text-xs">
                                <span className="text-gray-500">Chave PIX:</span> {withdrawal.payment_details.pix_key}
                              </p>
                              {withdrawal.payment_details.pix_key_type && (
                                <p className="text-cyan-400 text-xs">
                                  <span className="text-gray-500">Tipo:</span>{" "}
                                  {withdrawal.payment_details.pix_key_type === "cpf"
                                    ? "CPF"
                                    : withdrawal.payment_details.pix_key_type === "email"
                                      ? "E-mail"
                                      : withdrawal.payment_details.pix_key_type === "phone"
                                        ? "Celular"
                                        : "Chave Aleatória"}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-white font-bold">{formatCurrency(withdrawal.amount)}</p>
                            <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(withdrawal.status)}`}>
                              {withdrawal.status}
                            </span>
                          </div>
                          {withdrawal.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApproveWithdrawal(withdrawal)}
                                size="sm"
                                className="bg-green-500 hover:bg-green-600"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleRejectWithdrawal(withdrawal)}
                                size="sm"
                                variant="destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* KYC Tab */}
          {activeTab === "kyc" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Verificação KYC</h1>
                  <p className="text-gray-400">{kycRequests.length} solicitações</p>
                </div>
                <Button
                  onClick={fetchKyc}
                  variant="outline"
                  size="sm"
                  className="border-[#2A3142] text-gray-300 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              {kycLoading ? (
                <div className="text-center text-gray-400 py-8">Carregando...</div>
              ) : kycRequests.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhuma solicitação de KYC</div>
              ) : (
                <div className="space-y-4">
                  {kycRequests.map((kyc) => (
                    <div key={kyc.id} className="bg-[#1A1F2E] rounded-xl p-4 border border-[#2A3142]">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-white font-medium">{kyc.user_email || "Usuário"}</p>
                            <p className="text-gray-400 text-sm">{kyc.user_name || ""}</p>
                            <p className="text-gray-500 text-xs">{formatDate(kyc.created_at)}</p>
                          </div>
                          <span className={`px-3 py-1 text-sm rounded ${getStatusColor(kyc.status)}`}>
                            {kyc.status === "pending"
                              ? "Pendente"
                              : kyc.status === "approved"
                                ? "Aprovado"
                                : "Rejeitado"}
                          </span>
                        </div>

                        {/* Document Images - Clickable buttons */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Frente</p>
                            <button
                              onClick={() => openDocument(kyc.document_front_url, "Documento - Frente")}
                              disabled={!kyc.document_front_url || kycLoading || loading}
                              className="w-full aspect-video bg-[#0B0F14] rounded-lg border border-[#2A3142] flex items-center justify-center hover:border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {kyc.document_front_url ? (
                                <Eye className="h-5 w-5 text-green-500" />
                              ) : (
                                <span className="text-gray-500 text-xs">Não enviado</span>
                              )}
                            </button>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Verso</p>
                            <button
                              onClick={() => openDocument(kyc.document_back_url, "Documento - Verso")}
                              disabled={!kyc.document_back_url || kycLoading || loading}
                              className="w-full aspect-video bg-[#0B0F14] rounded-lg border border-[#2A3142] flex items-center justify-center hover:border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {kyc.document_back_url ? (
                                <Eye className="h-5 w-5 text-green-500" />
                              ) : (
                                <span className="text-gray-500 text-xs">Não enviado</span>
                              )}
                            </button>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Selfie</p>
                            <button
                              onClick={() => openDocument(kyc.selfie_with_document_url, "Selfie com Documento")}
                              disabled={!kyc.selfie_with_document_url || kycLoading || loading}
                              className="w-full aspect-video bg-[#0B0F14] rounded-lg border border-[#2A3142] flex items-center justify-center hover:border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {kyc.selfie_with_document_url ? (
                                <Eye className="h-5 w-5 text-green-500" />
                              ) : (
                                <span className="text-gray-500 text-xs">Não enviado</span>
                              )}
                            </button>
                          </div>
                        </div>

                        {kyc.rejection_reason && <p className="text-red-400 text-sm">Motivo: {kyc.rejection_reason}</p>}

                        {/* Success animation */}
                        {kycSuccess === kyc.id && (
                          <div className="flex items-center justify-center py-4 bg-green-500/20 rounded-lg border border-green-500/50 animate-pulse">
                            <Check className="w-6 h-6 text-green-500 mr-2" />
                            <span className="text-green-500 font-medium">Aprovado com sucesso!</span>
                          </div>
                        )}

                        {kyc.status === "pending" && !kycSuccess && (
                          <>
                            {rejectingKyc === kyc.id ? (
                              <div className="flex flex-col gap-2">
                                <Input
                                  placeholder="Motivo da rejeição..."
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => {
                                      setRejectingKyc(null)
                                      setRejectReason("")
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-[#2A3142]"
                                    disabled={processingKycId === kyc.id}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    onClick={() => handleKycAction("reject", kyc.id, kyc.user_id)}
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1"
                                    disabled={processingKycId === kyc.id}
                                  >
                                    {processingKycId === kyc.id ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Rejeitando...
                                      </>
                                    ) : (
                                      "Confirmar Rejeição"
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleKycAction("approve", kyc.id, kyc.user_id)}
                                  size="sm"
                                  className="flex-1 bg-green-500 hover:bg-green-600"
                                  disabled={processingKycId === kyc.id}
                                >
                                  {processingKycId === kyc.id ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                      Aprovando...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-4 h-4 mr-2" />
                                      Aprovar
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={() => setRejectingKyc(kyc.id)}
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  disabled={processingKycId === kyc.id}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Image Modal */}
              {imageModal.open && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setImageModal({ open: false, url: "", title: "" })}
                >
                  <div className="relative max-w-4xl w-full max-h-[90vh]">
                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
                      <h3 className="text-white font-medium">{imageModal.title}</h3>
                      <button
                        onClick={() => setImageModal({ open: false, url: "", title: "" })}
                        className="p-2 bg-white/10 rounded-full hover:bg-white/20"
                      >
                        <X className="h-5 w-5 text-white" />
                      </button>
                    </div>
                    <div className="flex items-center justify-center min-h-[300px]">
                      <img
                        src={imageModal.url || "/placeholder.svg"}
                        alt={imageModal.title}
                        className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = "/documento-n-o-encontrado.jpg"
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trades/Operações Tab */}
          {activeTab === "trades" && (
            <TradeEditor
              users={users.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }))}
              onRefresh={() => {
                fetchUsers()
                fetchStats()
              }}
            />
          )}

          {/* Affiliates Tab */}
          {activeTab === "affiliates" && <AdminAffiliates />}

          {activeTab === "cards" && <AdminCards />}

          {/* Ativos Tab */}
          {activeTab === "assets" && <AdminAssets />}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white">Configuracoes da Plataforma</h2>
              
              <div className="bg-[#1A1F2E] rounded-xl p-6 border border-[#2A3142]">
                <h3 className="text-lg font-semibold text-white mb-4">Metodos de Deposito</h3>
                
                <div className="space-y-4">
                  {/* Card Deposit Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#0B0F14] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Deposito via Cartao</p>
                        <p className="text-gray-400 text-sm">Permitir depositos usando cartao de credito/debito</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleCardDeposit}
                      disabled={settingsLoading}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        cardDepositEnabled ? "bg-green-500" : "bg-gray-600"
                      } ${settingsLoading ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                          cardDepositEnabled ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* PIX Always Enabled */}
                  <div className="flex items-center justify-between p-4 bg-[#0B0F14] rounded-lg opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Deposito via PIX</p>
                        <p className="text-gray-400 text-sm">Sempre habilitado</p>
                      </div>
                    </div>
                    <div className="w-14 h-7 rounded-full bg-green-500 relative">
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white" />
                    </div>
                  </div>

                  {/* Crypto Deposit Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#0B0F14] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <span className="text-yellow-500 font-bold text-sm">USDT</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">Deposito via Cripto (USDT)</p>
                        <p className="text-gray-400 text-sm">Permitir depositos usando USDT na rede Ethereum (minimo $20)</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleCryptoDeposit}
                      disabled={settingsLoading}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        cryptoDepositEnabled ? "bg-green-500" : "bg-gray-600"
                      } ${settingsLoading ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                          cryptoDepositEnabled ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-gray-500 text-xs mt-4">
                  As alteracoes sao aplicadas imediatamente para todos os usuarios.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#1A1F2E] rounded-xl p-6 w-full max-w-md border border-[#2A3142]">
            <h2 className="text-xl font-bold text-white mb-4">Editar Usuário</h2>
            <p className="text-gray-400 text-sm mb-4">{editingUser.email}</p>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Nome</label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm">Telefone</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm">Saldo Real (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.balance_real}
                  onChange={(e) => setEditForm({ ...editForm, balance_real: Number.parseFloat(e.target.value) || 0 })}
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm">Saldo Demo (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.balance_demo}
                  onChange={(e) => setEditForm({ ...editForm, balance_demo: Number.parseFloat(e.target.value) || 0 })}
                  className="bg-[#0B0F14] border-[#2A3142] text-white"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-gray-400">
                  <input
                    type="checkbox"
                    checked={editForm.is_verified}
                    onChange={(e) => setEditForm({ ...editForm, is_verified: e.target.checked })}
                    className="rounded"
                  />
                  Verificado
                </label>
                <label className="flex items-center gap-2 text-gray-400">
                  <input
                    type="checkbox"
                    checked={editForm.is_blocked}
                    onChange={(e) => setEditForm({ ...editForm, is_blocked: e.target.checked })}
                    className="rounded"
                  />
                  Bloqueado
                </label>
                <label className="flex items-center gap-2 text-green-400">
                  <input
                    type="checkbox"
                    checked={editForm.is_affiliate}
                    onChange={(e) => setEditForm({ ...editForm, is_affiliate: e.target.checked })}
                    className="rounded"
                  />
                  Afiliado
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setEditingUser(null)}
                variant="outline"
                className="flex-1 border-[#2A3142] text-gray-300"
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveUser} disabled={saving} className="flex-1 bg-green-500 hover:bg-green-600">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  badge,
}: {
  icon: any
  label: string
  value: string | number
  color: string
  badge?: string
}) {
  const accents: Record<string, string> = {
    blue: "#a855f7",
    green: "#22c55e",
    red: "#ef4444",
    purple: "#a78bfa",
    cyan: "#22d3ee",
    yellow: "#eab308",
  }
  const accent = accents[color] || "#a855f7"

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c121c] p-5 transition-all duration-300 hover:border-white/[0.12] hover:-translate-y-0.5">
      {/* glow radial sutil no hover */}
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full opacity-[0.12] blur-3xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: accent }}
      />
      {/* brilho superior */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }}
      />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[13px] font-medium uppercase tracking-wider text-gray-500">{label}</span>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110"
            style={{ background: `${accent}14`, color: accent, boxShadow: `0 0 0 1px ${accent}26, 0 4px 16px ${accent}1f` }}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[26px] font-bold leading-none tracking-tight text-white tabular-nums">{value}</p>
        {badge && (
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
            {badge}
          </p>
        )}
      </div>
    </div>
  )
}
