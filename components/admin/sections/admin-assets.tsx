"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { RefreshCw, Search, TrendingUp, Layers } from "lucide-react"

const ADMIN_TOKEN = "Admin123!"

interface AdminAsset {
  symbol: string
  name: string
  category: "forex" | "crypto" | "stocks"
  payout: number
  logo: string
  enabled: boolean
  sortOrder: number
}

const CATEGORY_LABELS: Record<string, string> = {
  forex: "Forex",
  crypto: "Cripto",
  stocks: "Ações",
}

export function AdminAssets() {
  const [assets, setAssets] = useState<AdminAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null)

  const fetchAssets = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/assets", { headers: { "x-admin-token": ADMIN_TOKEN } })
      const data = await res.json()
      if (res.ok) setAssets(data.assets || [])
    } catch (e) {
      console.error("[v0] erro ao carregar ativos", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssets()
  }, [])

  const toggleAsset = async (symbol: string, enabled: boolean) => {
    // Atualização otimista
    setAssets((prev) => prev.map((a) => (a.symbol === symbol ? { ...a, enabled } : a)))
    setSavingSymbol(symbol)
    try {
      const res = await fetch("/api/admin/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ symbol, enabled }),
      })
      if (!res.ok) throw new Error("falha")
    } catch (e) {
      // Reverte em caso de erro
      setAssets((prev) => prev.map((a) => (a.symbol === symbol ? { ...a, enabled: !enabled } : a)))
    } finally {
      setSavingSymbol(null)
    }
  }

  const filtered = assets.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.symbol.toLowerCase().includes(search.toLowerCase()),
  )

  const enabledCount = assets.filter((a) => a.enabled).length

  const grouped = filtered.reduce<Record<string, AdminAsset[]>>((acc, a) => {
    ;(acc[a.category] ||= []).push(a)
    return acc
  }, {})

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ativos</h1>
          <p className="mt-1 text-sm text-gray-400">
            {enabledCount} de {assets.length} ativos visíveis na plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Buscar ativo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/[0.06] bg-[#0c121c] pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white/20"
            />
          </div>
          <Button
            onClick={fetchAssets}
            variant="outline"
            size="icon"
            className="border-white/[0.06] bg-[#0c121c] hover:bg-[#141c2b]"
          >
            <RefreshCw className={`h-4 w-4 text-gray-300 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && assets.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Carregando ativos...
        </div>
      ) : (
        <div className="space-y-7">
          {Object.entries(grouped).map(([category, list]) => (
            <div key={category}>
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <span className="text-xs text-gray-600">({list.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((asset) => (
                  <div
                    key={asset.symbol}
                    className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-4 transition-all ${
                      asset.enabled
                        ? "border-white/[0.08] bg-[#0c121c]"
                        : "border-white/[0.04] bg-[#0a0e16] opacity-70"
                    }`}
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                      <Image
                        src={asset.logo || "/placeholder.svg"}
                        alt={asset.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{asset.name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <TrendingUp className="h-3 w-3" />
                          {asset.payout}%
                        </span>
                        <span className="text-xs text-gray-600">{asset.symbol}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Switch
                        checked={asset.enabled}
                        disabled={savingSymbol === asset.symbol}
                        onCheckedChange={(v) => toggleAsset(asset.symbol, v)}
                      />
                      <span className={`text-[10px] font-medium ${asset.enabled ? "text-emerald-400" : "text-gray-500"}`}>
                        {asset.enabled ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-16 text-center text-sm text-gray-500">Nenhum ativo encontrado.</p>
          )}
        </div>
      )}
    </div>
  )
}
