"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { GlobalCandle } from "@/lib/price-engine/global-price-engine"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

interface GlobalChartProps {
  candles: GlobalCandle[]
  currentCandle: GlobalCandle | null
  currentPrice: number
  timeframe: 60 | 300 | 600
  entryPrice?: number
  direction?: "CALL" | "PUT"
  expiryTime?: number
}

export function GlobalChart({
  candles,
  currentCandle,
  currentPrice,
  timeframe,
  entryPrice,
  direction,
  expiryTime,
}: GlobalChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const animationRef = useRef<number>()
  const lastRenderTime = useRef(0)

  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState(0)
  const lastTouchDistance = useRef<number | null>(null)
  const lastTouchX = useRef<number | null>(null)
  const isDragging = useRef(false)

  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + 0.25))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - 0.25))
  }, [])

  const handleReset = useCallback(() => {
    setZoomLevel(1)
    setPanOffset(0)
  }, [])

  // Touch/Mouse handlers
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
      } else if (e.touches.length === 1) {
        lastTouchX.current = e.touches[0].clientX
        isDragging.current = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const scale = distance / lastTouchDistance.current

        setZoomLevel((prev) => {
          const newZoom = prev * scale
          return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))
        })

        lastTouchDistance.current = distance
      } else if (e.touches.length === 1 && isDragging.current && lastTouchX.current !== null) {
        const deltaX = e.touches[0].clientX - lastTouchX.current
        setPanOffset((prev) => prev + deltaX * 0.5)
        lastTouchX.current = e.touches[0].clientX
      }
    }

    const handleTouchEnd = () => {
      lastTouchDistance.current = null
      lastTouchX.current = null
      isDragging.current = false
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoomLevel((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)))
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: false })
    container.addEventListener("touchmove", handleTouchMove, { passive: false })
    container.addEventListener("touchend", handleTouchEnd)
    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
      container.removeEventListener("wheel", handleWheel)
    }
  }, [])

  // Resize handler
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return

    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    const render = () => {
      const now = performance.now()
      // Limita a 30fps para suavidade sem consumo excessivo
      if (now - lastRenderTime.current < 33) {
        animationRef.current = requestAnimationFrame(render)
        return
      }
      lastRenderTime.current = now

      // HiDPI support
      const dpr = window.devicePixelRatio || 1
      canvas.width = dimensions.width * dpr
      canvas.height = dimensions.height * dpr
      ctx.scale(dpr, dpr)

      // Background gradient profissional
      const bgGradient = ctx.createLinearGradient(0, 0, 0, dimensions.height)
      bgGradient.addColorStop(0, "#0a0a0c")
      bgGradient.addColorStop(1, "#101014")
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, dimensions.width, dimensions.height)

      // Combina candles
      const allCandles = [...candles]
      if (currentCandle) {
        allCandles.push(currentCandle)
      }

      if (allCandles.length === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
        ctx.font = "13px Inter, system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("Carregando gráfico...", dimensions.width / 2, dimensions.height / 2)
        return
      }

      // Calcula range de preço
      let minPrice = Number.POSITIVE_INFINITY
      let maxPrice = Number.NEGATIVE_INFINITY

      for (const candle of allCandles) {
        minPrice = Math.min(minPrice, candle.low)
        maxPrice = Math.max(maxPrice, candle.high)
      }

      const priceRange = maxPrice - minPrice || 0.0001
      const padding = priceRange * 0.12
      minPrice -= padding
      maxPrice += padding
      const totalRange = maxPrice - minPrice

      const isMobile = dimensions.width < 500
      const chartPadding = {
        top: isMobile ? 45 : 25,
        right: isMobile ? 58 : 72,
        bottom: isMobile ? 28 : 35,
        left: isMobile ? 8 : 12,
      }
      const chartWidth = dimensions.width - chartPadding.left - chartPadding.right
      const chartHeight = dimensions.height - chartPadding.top - chartPadding.bottom

      const priceToY = (price: number) => {
        const ratio = (maxPrice - price) / totalRange
        return chartPadding.top + ratio * chartHeight
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)"
      ctx.lineWidth = 1

      const gridLines = isMobile ? 5 : 7
      for (let i = 0; i <= gridLines; i++) {
        const y = chartPadding.top + (chartHeight / gridLines) * i
        ctx.beginPath()
        ctx.moveTo(chartPadding.left, y)
        ctx.lineTo(chartPadding.left + chartWidth, y)
        ctx.stroke()

        const price = maxPrice - (totalRange / gridLines) * i
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)"
        ctx.font = isMobile ? "9px monospace" : "10px monospace"
        ctx.textAlign = "left"
        ctx.fillText(price.toFixed(5), chartPadding.left + chartWidth + 5, y + 3)
      }

      // Linhas verticais sutis
      const verticalLines = isMobile ? 5 : 7
      for (let i = 0; i <= verticalLines; i++) {
        const x = chartPadding.left + (chartWidth / verticalLines) * i
        ctx.beginPath()
        ctx.moveTo(x, chartPadding.top)
        ctx.lineTo(x, chartPadding.top + chartHeight)
        ctx.stroke()
      }

      const baseVisibleCandles = isMobile ? 50 : 70
      const visibleCandles = Math.max(15, Math.floor(baseVisibleCandles / zoomLevel))
      const totalWidth = chartWidth - 10
      const candleSpacing = totalWidth / visibleCandles
      const candleWidth = Math.max(3, Math.min(12, candleSpacing * 0.75))
      const gap = candleSpacing - candleWidth

      const maxPanOffset = Math.max(0, (allCandles.length - visibleCandles) * candleSpacing)
      const clampedPanOffset = Math.max(-maxPanOffset, Math.min(0, panOffset))
      const startIndex = Math.max(0, allCandles.length - visibleCandles - Math.floor(clampedPanOffset / candleSpacing))

      for (let i = startIndex; i < Math.min(allCandles.length, startIndex + visibleCandles + 1); i++) {
        const candle = allCandles[i]
        const relativeIndex = i - startIndex
        const x = chartPadding.left + 5 + relativeIndex * candleSpacing + candleWidth / 2

        const openY = priceToY(candle.open)
        const closeY = priceToY(candle.close)
        const highY = priceToY(candle.high)
        const lowY = priceToY(candle.low)

        const isBullish = candle.close >= candle.open

        // Cores profissionais estilo trading
        const bullColor = "#a855f7"
        const bearColor = "#ef4444"
        const color = isBullish ? bullColor : bearColor

        // Wick com sombra sutil
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(1, candleWidth * 0.15)
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.moveTo(x, highY)
        ctx.lineTo(x, lowY)
        ctx.stroke()

        // Body com leve gradiente
        const bodyTop = Math.min(openY, closeY)
        const bodyHeight = Math.max(1.5, Math.abs(closeY - openY))

        // Gradiente sutil no corpo
        const bodyGradient = ctx.createLinearGradient(x - candleWidth / 2, bodyTop, x + candleWidth / 2, bodyTop)
        if (isBullish) {
          bodyGradient.addColorStop(0, "#a855f7")
          bodyGradient.addColorStop(1, "#9333ea")
        } else {
          bodyGradient.addColorStop(0, "#ef4444")
          bodyGradient.addColorStop(1, "#dc2626")
        }

        ctx.fillStyle = bodyGradient
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)

        // Borda sutil
        ctx.strokeStyle = isBullish ? "#7e22ce" : "#b91c1c"
        ctx.lineWidth = 0.5
        ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)
      }

      const currentPriceY = priceToY(currentPrice)

      // Linha tracejada sutil
      ctx.strokeStyle = "rgba(96, 165, 250, 0.5)"
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(chartPadding.left, currentPriceY)
      ctx.lineTo(chartPadding.left + chartWidth, currentPriceY)
      ctx.stroke()
      ctx.setLineDash([])

      // Label do preço atual com design moderno
      const priceBoxWidth = isMobile ? 54 : 66
      const priceBoxHeight = 20

      // Fundo com bordas arredondadas
      ctx.fillStyle = "#a855f7"
      ctx.beginPath()
      const boxX = chartPadding.left + chartWidth + 3
      const boxY = currentPriceY - priceBoxHeight / 2
      const radius = 3
      ctx.moveTo(boxX + radius, boxY)
      ctx.lineTo(boxX + priceBoxWidth - radius, boxY)
      ctx.quadraticCurveTo(boxX + priceBoxWidth, boxY, boxX + priceBoxWidth, boxY + radius)
      ctx.lineTo(boxX + priceBoxWidth, boxY + priceBoxHeight - radius)
      ctx.quadraticCurveTo(
        boxX + priceBoxWidth,
        boxY + priceBoxHeight,
        boxX + priceBoxWidth - radius,
        boxY + priceBoxHeight,
      )
      ctx.lineTo(boxX + radius, boxY + priceBoxHeight)
      ctx.quadraticCurveTo(boxX, boxY + priceBoxHeight, boxX, boxY + priceBoxHeight - radius)
      ctx.lineTo(boxX, boxY + radius)
      ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY)
      ctx.fill()

      // Seta apontando para a linha
      ctx.beginPath()
      ctx.moveTo(boxX, currentPriceY)
      ctx.lineTo(boxX - 5, currentPriceY - 4)
      ctx.lineTo(boxX - 5, currentPriceY + 4)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = "#fff"
      ctx.font = `bold ${isMobile ? 9 : 10}px monospace`
      ctx.textAlign = "center"
      ctx.fillText(currentPrice.toFixed(5), boxX + priceBoxWidth / 2, currentPriceY + 3.5)

      if (entryPrice) {
        const entryY = priceToY(entryPrice)
        const entryColor = direction === "CALL" ? "#a855f7" : "#ef4444"

        ctx.strokeStyle = entryColor
        ctx.lineWidth = 1.5
        ctx.setLineDash([8, 4])
        ctx.beginPath()
        ctx.moveTo(chartPadding.left, entryY)
        ctx.lineTo(chartPadding.left + chartWidth, entryY)
        ctx.stroke()
        ctx.setLineDash([])

        // Indicador de direção
        ctx.fillStyle = entryColor
        ctx.beginPath()
        if (direction === "CALL") {
          ctx.moveTo(chartPadding.left + 15, entryY + 6)
          ctx.lineTo(chartPadding.left + 21, entryY - 2)
          ctx.lineTo(chartPadding.left + 27, entryY + 6)
        } else {
          ctx.moveTo(chartPadding.left + 15, entryY - 6)
          ctx.lineTo(chartPadding.left + 21, entryY + 2)
          ctx.lineTo(chartPadding.left + 27, entryY - 6)
        }
        ctx.closePath()
        ctx.fill()

        // Label da direção
        ctx.fillStyle = entryColor
        ctx.font = `bold ${isMobile ? 9 : 10}px Inter, system-ui, sans-serif`
        ctx.textAlign = "left"
        ctx.fillText(direction || "", chartPadding.left + 32, entryY + 3)
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
      ctx.font = isMobile ? "8px monospace" : "9px monospace"
      ctx.textAlign = "center"

      const timeLabels = isMobile ? 4 : 6
      for (let i = 0; i <= timeLabels; i++) {
        const idx = Math.floor(startIndex + (visibleCandles / timeLabels) * i)
        if (idx < allCandles.length) {
          const candle = allCandles[idx]
          const x = chartPadding.left + 5 + (chartWidth / timeLabels) * i
          const date = new Date(candle.time * 1000)
          const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
          ctx.fillText(timeStr, x, dimensions.height - 8)
        }
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
      ctx.font = `600 ${isMobile ? 11 : 13}px Inter, system-ui, sans-serif`
      ctx.textAlign = "left"
      ctx.fillText("EUR/USD (OTC)", chartPadding.left + 8, isMobile ? 18 : 20)

      const tfLabel = timeframe === 60 ? "1M" : timeframe === 300 ? "5M" : "10M"
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)"
      ctx.font = `500 ${isMobile ? 9 : 11}px Inter, system-ui, sans-serif`
      ctx.fillText(tfLabel, chartPadding.left + (isMobile ? 85 : 110), isMobile ? 18 : 20)

      // Indicador de zoom
      if (zoomLevel !== 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
        ctx.font = "9px Inter, system-ui, sans-serif"
        ctx.textAlign = "right"
        ctx.fillText(`${Math.round(zoomLevel * 100)}%`, dimensions.width - chartPadding.right - 5, isMobile ? 18 : 20)
      }
    }

    // Start continuous animation loop for smooth candle updates
    const animate = () => {
      render()
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [
    candles,
    currentCandle,
    currentPrice,
    dimensions,
    timeframe,
    entryPrice,
    direction,
    expiryTime,
    zoomLevel,
    panOffset,
  ])

  return (
    <div ref={containerRef} className="w-full h-full relative touch-none" style={{ backgroundColor: "#0a0a0c" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
      />

      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded flex items-center justify-center transition-colors border border-white/10"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5 text-white/70" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded flex items-center justify-center transition-colors border border-white/10"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5 text-white/70" />
        </button>
        <button
          onClick={handleReset}
          className="w-7 h-7 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded flex items-center justify-center transition-colors border border-white/10"
          aria-label="Reset zoom"
        >
          <RotateCcw className="w-3.5 h-3.5 text-white/70" />
        </button>
      </div>
    </div>
  )
}
