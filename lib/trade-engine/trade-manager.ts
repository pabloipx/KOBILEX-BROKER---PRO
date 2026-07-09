/**
 * Trade Manager - SERVERLESS COMPATIBLE
 * Trades são resolvidos via API call, não via setTimeout
 */

import type { Trade } from "@/lib/types"

function getSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  
  if (!url || !key) return null
  
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Função para gerar preço determinístico (mesmo algoritmo do price-engine)
function generatePriceAtTime(timestamp: number): number {
  const basePrice = 1.085
  const seed = timestamp
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453123
  const random = x - Math.floor(x)
  
  const microCycle = random * 0.0001 - 0.00005
  const shortCycle = Math.sin(seed * 0.01) * 0.0003
  const mediumCycle = Math.sin(seed * 0.001) * 0.0005
  const longCycle = Math.sin(seed * 0.0001) * 0.001
  
  const deviation = microCycle + shortCycle + mediumCycle + longCycle
  const price = basePrice + deviation
  const maxDev = basePrice * 0.008
  
  return Number(Math.max(basePrice - maxDev, Math.min(basePrice + maxDev, price)).toFixed(5))
}

export class TradeManager {
  async openTrade(
    userId: string,
    symbol: string,
    direction: "CALL" | "PUT",
    amount: number,
    duration: number,
  ): Promise<{ success: boolean; trade?: Trade; error?: string; newBalance?: number }> {
    try {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: "Database not configured" }
      }

      const { data: balanceData, error: balanceError } = await supabase
        .from("user_balances")
        .select("balance")
        .eq("user_id", userId)
        .single()

      if (balanceError || !balanceData) {
        return { success: false, error: "Failed to fetch balance" }
      }

      if (balanceData.balance < amount) {
        return { success: false, error: "Insufficient balance" }
      }

      const currentPrice = generatePriceAtTime(Math.floor(Date.now() / 1000))

      const now = new Date()
      const expiryTime = new Date(now.getTime() + duration * 1000)
      const payoutPercentage = 0.96

      const newBalance = Number(balanceData.balance) - amount
      const { error: updateError } = await supabase
        .from("user_balances")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", userId)

      if (updateError) {
        return { success: false, error: "Failed to update balance" }
      }

      const { data: tradeData, error: tradeError } = await supabase
        .from("trades")
        .insert({
          user_id: userId,
          symbol,
          direction,
          amount,
          entry_price: currentPrice,
          timeframe: duration,
          payout_percentage: payoutPercentage,
          result: "PENDING",
          expiry_time: expiryTime.toISOString(),
          entry_time: now.toISOString(),
        })
        .select()
        .single()

      if (tradeError || !tradeData) {
        await supabase.from("user_balances").update({ balance: balanceData.balance }).eq("user_id", userId)
        return { success: false, error: "Failed to create trade" }
      }

      return { success: true, trade: tradeData as Trade, newBalance }
    } catch (error) {
      console.error("Error opening trade:", error)
      return { success: false, error: "Internal error" }
    }
  }

  async resolveTrade(tradeId: string): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: "Database not configured" }
      }

      const { data: trade, error: tradeError } = await supabase
        .from("trades")
        .select("*")
        .eq("id", tradeId)
        .single()

      if (tradeError || !trade) {
        return { success: false, error: "Trade not found" }
      }

      if (trade.result !== "PENDING") {
        return { success: true, result: trade.result }
      }

      const exitPrice = generatePriceAtTime(Math.floor(Date.now() / 1000))
      const priceDiff = exitPrice - trade.entry_price
      
      let result: "WIN" | "LOSS"
      if (trade.direction === "CALL") {
        result = priceDiff > 0 ? "WIN" : "LOSS"
      } else {
        result = priceDiff < 0 ? "WIN" : "LOSS"
      }

      let profit = 0
      if (result === "WIN") {
        profit = trade.amount * trade.payout_percentage
      } else {
        profit = -trade.amount
      }

      await supabase
        .from("trades")
        .update({
          exit_price: exitPrice,
          result,
          profit,
          exit_time: new Date().toISOString(),
        })
        .eq("id", tradeId)

      const { data: balanceData } = await supabase
        .from("user_balances")
        .select("balance")
        .eq("user_id", trade.user_id)
        .single()

      if (balanceData) {
        const newBalance = Number(balanceData.balance) + trade.amount + profit
        await supabase
          .from("user_balances")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("user_id", trade.user_id)
      }

      return { success: true, result }
    } catch (error) {
      console.error("Error resolving trade:", error)
      return { success: false, error: "Internal error" }
    }
  }

  async getActiveTrade(userId: string): Promise<Trade | null> {
    try {
      const supabase = getSupabaseAdmin()
      if (!supabase) return null

      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .eq("result", "PENDING")
        .order("entry_time", { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return null
      return data as Trade
    } catch {
      return null
    }
  }

  async restoreActiveTrades() {
    // No-op em serverless - trades são resolvidos via API
  }
}

let tradeManagerInstance: TradeManager | null = null

export function getTradeManager(): TradeManager {
  if (!tradeManagerInstance) {
    tradeManagerInstance = new TradeManager()
  }
  return tradeManagerInstance
}
