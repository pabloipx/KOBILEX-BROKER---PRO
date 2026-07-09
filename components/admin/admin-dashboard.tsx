"use client"

import { useEffect, useState } from "react"
import { AdminHome } from "./sections/admin-home"
import { AdminUsers } from "./sections/admin-users"
import { AdminDeposits } from "./sections/admin-deposits"
import { AdminWithdrawals } from "./sections/admin-withdrawals"
import { AdminMarkets } from "./sections/admin-markets"
import { AdminSettings } from "./sections/admin-settings"
import { AdminAffiliates } from "./sections/admin-affiliates"
import { TradeEditor } from "./trade-editor"

interface AdminDashboardProps {
  activeSection: string
}

const ADMIN_PASSWORD = "Admin123!"

export function AdminDashboard({ activeSection }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalUsers: 0,
    totalBalances: 0,
    totalTrades: 0,
    platformProfit: 0,
    pendingWithdrawals: 0,
    pendingDeposits: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    setRefreshKey((k) => k + 1)
    try {
      const response = await fetch("/api/admin/stats", {
        headers: {
          "x-admin-token": ADMIN_PASSWORD,
        },
      })

      if (!response.ok) {
        console.error("Failed to fetch stats:", response.statusText)
        return
      }

      const data = await response.json()

      setStats({
        totalDeposits: data.totalDeposits || 0,
        totalWithdrawals: data.totalWithdrawals || 0,
        totalUsers: data.totalUsers || 0,
        totalBalances: data.totalBalance || 0,
        totalTrades: data.totalTrades || 0,
        platformProfit: data.platformProfit || 0,
        pendingWithdrawals: data.pendingWithdrawals || 0,
        pendingDeposits: data.pendingDeposits || 0,
      })
    } catch (error) {
      console.error("Error loading stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const renderSection = () => {
    switch (activeSection) {
      case "inicio":
        return <AdminHome stats={stats} loading={loading} onRefresh={loadStats} refreshKey={refreshKey} />
      case "usuarios":
        return <AdminUsers />
      case "depositos":
        return <AdminDeposits onUpdate={loadStats} />
      case "saques":
        return <AdminWithdrawals onUpdate={loadStats} />
      case "afiliados":
        return <AdminAffiliates />
      case "operacoes":
        return <TradeEditor />
      case "mercados":
        return <AdminMarkets />
      case "plataforma":
      case "pagamentos":
      case "landpage":
      case "seguranca":
        return <AdminSettings section={activeSection} />
      default:
        return <AdminHome stats={stats} loading={loading} onRefresh={loadStats} refreshKey={refreshKey} />
    }
  }

  return <div className="p-4 md:p-6">{renderSection()}</div>
}
