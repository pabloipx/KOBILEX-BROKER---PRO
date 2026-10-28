"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import { Timer } from "lucide-react"
import { expiryAtFor, purchaseDeadlineMs } from "@/lib/trading/expiry"

type Props = {
  chartRef: MutableRefObject<any>
  seriesRef: MutableRefObject<any>
  timeframe: number
  expirySeconds: number
  /** Com operacao aberta no ativo o cronometro vai para a faixa de resultado no topo. */
  showPurchaseLabel: boolean
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

/**
 * Linha pontilhada = limite para comprar no minuto atual; linha vermelha = horario de expiracao.
 * Posicionadas por indice logico porque o horario fica a direita da ultima vela (sem dado ali).
 */
export function ChartExpiryLines({ chartRef, seriesRef, timeframe, expirySeconds, showPurchaseLabel }: Props) {
  const buyRef = useRef<HTMLDivElement>(null)
  const expRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLSpanElement>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const place = (el: HTMLDivElement | null, x: number | null, width: number, axis: number) => {
      if (!el) return
      if (x == null || !Number.isFinite(x) || x < 0 || x > width) {
        el.style.opacity = "0"
        return
      }
      el.style.opacity = "1"
      el.style.transform = `translateX(${Math.round(x)}px)`
      el.style.bottom = `${axis}px`
    }

    const tick = () => {
      if (document.hidden) return
      const chart = chartRef.current
      const series = seriesRef.current
      if (!chart || !series) return
      let data: any[] = []
      try {
        data = series.data?.() || []
      } catch {}
      if (data.length === 0) return
      const last = data[data.length - 1]
      const lastTime = typeof last.time === "number" ? last.time : Number(last.time)
      if (!Number.isFinite(lastTime)) return

      const ts = chart.timeScale()
      const width = ts.width?.() ?? 0
      const axis = ts.height?.() ?? 28
      const toX = (ms: number) => ts.logicalToCoordinate(data.length - 1 + (ms / 1000 - lastTime) / timeframe)

      const now = Date.now()
      const deadline = purchaseDeadlineMs(now)
      place(buyRef.current, toX(deadline), width, axis)
      place(expRef.current, toX(expiryAtFor(now, expirySeconds)), width, axis)

      const remaining = deadline - now
      if (timerRef.current) timerRef.current.textContent = fmt(remaining)
      if (badgeRef.current) badgeRef.current.textContent = `:${String(Math.max(0, Math.ceil(remaining / 1000)) % 60).padStart(2, "0")}`
    }

    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [chartRef, seriesRef, timeframe, expirySeconds])

  return (
    <div className="pointer-events-none absolute inset-0 z-[17] overflow-hidden" aria-hidden="true">
      <div ref={buyRef} className="absolute left-0 top-0 opacity-0" style={{ bottom: 28 }}>
        <div className="absolute inset-y-0 left-0 border-l border-dotted border-tr-fg/80" />
        {showPurchaseLabel && (
          <div className="absolute right-1 top-3 flex items-center gap-1.5 whitespace-nowrap text-tr-fg">
            <span className="text-right text-[9px] font-medium uppercase leading-[1.1]">
              Hora de
              <br />
              compra
            </span>
            <span ref={timerRef} className="text-2xl tabular-nums" />
          </div>
        )}
        <span className="absolute bottom-1 left-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-tr-fg/70 bg-tr-chart text-[9px] font-semibold tabular-nums text-tr-fg">
          {showPurchaseLabel ? <Timer className="w-3.5 h-3.5" /> : <span ref={badgeRef} />}
        </span>
      </div>
      <div ref={expRef} className="absolute left-0 top-0 opacity-0" style={{ bottom: 28 }}>
        <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-tr-down" />
        <span className="absolute bottom-1 left-1 h-4 w-4 rounded-full bg-tr-down/90" />
      </div>
    </div>
  )
}
