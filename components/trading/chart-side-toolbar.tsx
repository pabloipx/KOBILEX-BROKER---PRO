"use client"

import { useState, type ReactNode } from "react"
import { Check, Pencil, Radio, Spline, Trash2 } from "lucide-react"

type Candle = { open: number; close: number }
export type CandleStyle = "solid" | "hollow"
type Menu = "type" | "tf" | "draw" | "ind" | "zoom" | null
type IndicatorKey = "ma" | "boll" | "fractal" | "macd"

type Props = {
  candles: Candle[]
  timeframe: number
  timeframeOptions: number[]
  onTimeframeChange?: (tf: number) => void
  candleStyle: CandleStyle
  onCandleStyleChange: (s: CandleStyle) => void
  drawTools: { id: string; label: string; icon: ReactNode }[]
  tool: string
  onToolChange: (id: string) => void
  drawColor: string
  drawColors: readonly string[]
  onColorChange: (c: string) => void
  canClear: boolean
  onClear: () => void
  indicators: Record<IndicatorKey, boolean>
  onIndicatorToggle: (k: IndicatorKey) => void
  zoomLabel: string
  zoomOptions: { label: string; seconds: number }[]
  onZoom: (seconds: number) => void
}

export const spanLabel = (s: number) => (s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`)

const CHEVRON_UP = "polygon(50% 0, 100% 45%, 100% 100%, 50% 55%, 0 100%, 0 45%)"
const CHEVRON_DOWN = "polygon(0 0, 50% 45%, 100% 0, 100% 55%, 50% 100%, 0 55%)"

function Sentiment({ candles }: { candles: Candle[] }) {
  const recent = candles.slice(-30)
  const ups = recent.filter((c) => c.close >= c.open).length
  const upPct = recent.length ? Math.round((ups / recent.length) * 100) : 50
  const steps = 18
  const upSteps = Math.round((upPct / 100) * steps)

  return (
    <div
      className="hidden lg:flex flex-col items-center text-tr-fg"
      role="img"
      aria-label={`Sentimento dos traders: ${upPct}% acima, ${100 - upPct}% abaixo`}
    >
      <span className="text-[11px] uppercase leading-tight tracking-wide">Acima</span>
      <span className="text-sm leading-tight tabular-nums">{upPct}%</span>
      <div className="my-1.5 flex flex-col items-center gap-px" aria-hidden="true">
        {Array.from({ length: steps }).map((_, i) => {
          const up = i < upSteps
          return (
            <span
              key={i}
              className={`-mt-1 h-3.5 w-6 first:mt-0 ${up ? "bg-tr-up/45" : "bg-tr-down/45"}`}
              style={{ clipPath: up ? CHEVRON_UP : CHEVRON_DOWN }}
            />
          )
        })}
      </div>
      <span className="text-[11px] uppercase leading-tight tracking-wide">Abaixo</span>
      <span className="text-sm leading-tight tabular-nums">{100 - upPct}%</span>
    </div>
  )
}

function ToolButton({
  label,
  active,
  open,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  open?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-md border text-[13px] font-semibold transition-colors ${
        open
          ? "border-tr-fg/40 bg-tr-line text-tr-fg"
          : active
            ? "border-tr-line bg-tr-raised text-tr-brand"
            : "border-tr-line bg-tr-raised text-tr-fg hover:bg-tr-line"
      }`}
    >
      {children}
    </button>
  )
}

function Popover({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="absolute left-11 top-0 z-40 min-w-44 rounded-md border border-tr-line bg-tr-raised p-1.5 shadow-xl">
      <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-tr-muted">{title}</p>
      {children}
    </div>
  )
}

function Option({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-tr-line ${
        selected ? "text-tr-fg" : "text-tr-muted"
      }`}
    >
      <span className="flex items-center gap-2">{children}</span>
      {selected && <Check className="w-3.5 h-3.5 text-tr-brand" aria-hidden="true" />}
    </button>
  )
}

function CandlesIcon({ hollow }: { hollow: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 1v14" stroke="currentColor" strokeWidth="1" />
      <rect x="2.5" y="4" width="4" height="7" rx="0.5" fill={hollow ? "none" : "currentColor"} stroke="currentColor" />
      <path d="M11.5 3v9" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <rect x="9.5" y="5" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

const INDICATORS: { key: IndicatorKey; label: string; desc: string }[] = [
  { key: "ma", label: "Médias Móveis", desc: "SMA 9 / 21" },
  { key: "boll", label: "Bandas de Bollinger", desc: "20, 2" },
  { key: "macd", label: "MACD", desc: "12, 26, 9" },
]

export function ChartSideToolbar(props: Props) {
  const [menu, setMenu] = useState<Menu>(null)
  const toggle = (m: Menu) => setMenu((cur) => (cur === m ? null : m))
  const close = () => setMenu(null)
  const drawingActive = props.tool !== "cursor"
  const anyIndicator = props.indicators.ma || props.indicators.boll || props.indicators.macd

  return (
    <>
      {menu && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-[29] cursor-default"
          onClick={close}
        />
      )}
      <div className="absolute left-2 top-[104px] z-30 flex flex-col items-center gap-3">
        <Sentiment candles={props.candles} />

        <div className="flex flex-col items-center gap-1.5">
          <div className="relative">
            <ToolButton label="Tipo de gráfico" open={menu === "type"} onClick={() => toggle("type")}>
              <CandlesIcon hollow={props.candleStyle === "hollow"} />
            </ToolButton>
            {menu === "type" && (
              <Popover title="Tipo de gráfico">
                <Option selected={props.candleStyle === "solid"} onClick={() => (props.onCandleStyleChange("solid"), close())}>
                  <CandlesIcon hollow={false} /> Velas
                </Option>
                <Option selected={props.candleStyle === "hollow"} onClick={() => (props.onCandleStyleChange("hollow"), close())}>
                  <CandlesIcon hollow /> Velas ocas
                </Option>
              </Popover>
            )}
          </div>

          <div className="relative">
            <ToolButton label="Tempo da vela" open={menu === "tf"} onClick={() => toggle("tf")}>
              {spanLabel(props.timeframe)}
            </ToolButton>
            {menu === "tf" && (
              <Popover title="Tempo da vela">
                {props.timeframeOptions.map((tf) => (
                  <Option
                    key={tf}
                    selected={props.timeframe === tf}
                    onClick={() => {
                      props.onTimeframeChange?.(tf)
                      close()
                    }}
                  >
                    {tf < 3600 ? `${tf / 60} minuto${tf === 60 ? "" : "s"}` : `${tf / 3600} hora${tf === 3600 ? "" : "s"}`}
                  </Option>
                ))}
              </Popover>
            )}
          </div>

          <ToolButton
            label={props.indicators.fractal ? "Desativar sinais" : "Ativar sinais (fractais)"}
            active={props.indicators.fractal}
            onClick={() => props.onIndicatorToggle("fractal")}
          >
            <Radio className="w-4 h-4" aria-hidden="true" />
          </ToolButton>

          <div className="relative">
            <ToolButton label="Ferramentas de desenho" active={drawingActive} open={menu === "draw"} onClick={() => toggle("draw")}>
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </ToolButton>
            {menu === "draw" && (
              <Popover title="Desenho">
                {props.drawTools.map((dt) => (
                  <Option
                    key={dt.id}
                    selected={props.tool === dt.id}
                    onClick={() => {
                      props.onToolChange(dt.id)
                      close()
                    }}
                  >
                    <span className="flex h-4 w-4 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">{dt.icon}</span>
                    {dt.label}
                  </Option>
                ))}
                <div className="my-1 h-px bg-tr-line" />
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  {props.drawColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      aria-pressed={c === props.drawColor}
                      onClick={() => props.onColorChange(c)}
                      className={`h-4 w-4 rounded-full border-2 transition-transform hover:scale-110 ${
                        c === props.drawColor ? "border-tr-fg" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!props.canClear}
                  onClick={() => {
                    props.onClear()
                    close()
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-tr-muted transition-colors hover:bg-tr-line hover:text-tr-down disabled:pointer-events-none disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Limpar desenhos
                </button>
              </Popover>
            )}
          </div>

          <div className="relative">
            <ToolButton label="Indicadores" active={anyIndicator} open={menu === "ind"} onClick={() => toggle("ind")}>
              <Spline className="w-4 h-4" aria-hidden="true" />
            </ToolButton>
            {menu === "ind" && (
              <Popover title="Indicadores">
                {INDICATORS.map((it) => (
                  <Option key={it.key} selected={props.indicators[it.key]} onClick={() => props.onIndicatorToggle(it.key)}>
                    <span className="flex flex-col">
                      <span>{it.label}</span>
                      <span className="text-[10px] text-tr-muted">{it.desc}</span>
                    </span>
                  </Option>
                ))}
              </Popover>
            )}
          </div>

          <div className="relative">
            <ToolButton label="Escala de tempo" open={menu === "zoom"} onClick={() => toggle("zoom")}>
              {props.zoomLabel}
            </ToolButton>
            {menu === "zoom" && (
              <Popover title="Período visível">
                {props.zoomOptions.map((z) => (
                  <Option
                    key={z.seconds}
                    selected={props.zoomLabel === z.label}
                    onClick={() => {
                      props.onZoom(z.seconds)
                      close()
                    }}
                  >
                    {z.label}
                  </Option>
                ))}
              </Popover>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
