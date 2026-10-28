"use client"

import { Plus, Minus, HelpCircle, Clock, Lock } from "lucide-react"
import { formatClock, useNow } from "./use-now"

type Props = {
  amount: number
  maxAmount: number
  onAmountChange: (value: number) => void
  onAmountStep: (delta: number) => void
  expirySeconds: number
  canDecreaseExpiry: boolean
  canIncreaseExpiry: boolean
  onExpiryStep: (delta: number) => void
  payout: number
  expectedReturn: number
  disabled: boolean
  blockedReason?: string | null
  blockedHint?: string | null
  error?: string | null
  onTrade: (direction: "CALL" | "PUT") => void
  onHover: (direction: "call" | "put" | null) => void
}

const fmt = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function ExpiryClock({ seconds }: { seconds: number }) {
  const now = useNow(1000)
  return <span className="tabular-nums">{formatClock(now + seconds * 1000)}</span>
}

export function TraderoomTradePanel(props: Props) {
  const {
    amount,
    maxAmount,
    onAmountChange,
    onAmountStep,
    expirySeconds,
    canDecreaseExpiry,
    canIncreaseExpiry,
    onExpiryStep,
    payout,
    expectedReturn,
    disabled,
    blockedReason,
    blockedHint,
    error,
    onTrade,
    onHover,
  } = props

  return (
    <div className="hidden lg:flex w-[120px] shrink-0 flex-col gap-2 py-2 pr-2.5 bg-tr-chart">
      <StepperBox
        label="Invest"
        onPlus={() => onAmountStep(1)}
        onMinus={() => onAmountStep(-1)}
        plusDisabled={amount >= maxAmount}
        minusDisabled={amount <= 1}
      >
        <label className="flex items-center gap-1 text-tr-fg">
          <span className="text-tr-muted">R$</span>
          <span className="sr-only">Valor do investimento</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={maxAmount}
            value={amount}
            onChange={(e) => onAmountChange(Number.parseFloat(e.target.value) || 1)}
            className="w-full min-w-0 bg-transparent text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </label>
      </StepperBox>

      <StepperBox
        label="Expiração"
        onPlus={() => onExpiryStep(1)}
        onMinus={() => onExpiryStep(-1)}
        plusDisabled={!canIncreaseExpiry}
        minusDisabled={!canDecreaseExpiry}
      >
        <span className="flex items-center gap-1 text-sm text-tr-fg">
          <Clock className="w-3 h-3" aria-hidden="true" />
          <ExpiryClock seconds={expirySeconds} />
        </span>
      </StepperBox>

      <div className="flex flex-col items-center gap-1 py-2">
        <span className="flex items-center gap-1 text-xs text-tr-fg">
          Lucro <HelpCircle className="w-3 h-3 text-tr-muted" aria-hidden="true" />
        </span>
        <span className="text-[40px] font-light leading-none text-tr-up">
          +{payout}
          <span className="text-xl">%</span>
        </span>
        <span className="text-lg font-bold text-tr-up tabular-nums">+R$ {fmt(expectedReturn)}</span>
      </div>

      {disabled && blockedReason && (
        <div className="flex flex-col gap-1 bg-tr-warn/10 p-2 text-[11px] leading-snug text-tr-warn">
          <span className="flex items-center gap-1 font-semibold">
            <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
            {blockedReason}
          </span>
          {blockedHint && <span className="opacity-80">{blockedHint}</span>}
        </div>
      )}

      <TradeButton direction="CALL" disabled={disabled} onTrade={onTrade} onHover={onHover} />
      <TradeButton direction="PUT" disabled={disabled} onTrade={onTrade} onHover={onHover} />

      {error && <p className="bg-tr-down/20 p-2 text-center text-[11px] text-tr-fg">{error}</p>}
    </div>
  )
}

function StepperBox({
  label,
  children,
  onPlus,
  onMinus,
  plusDisabled,
  minusDisabled,
}: {
  label: string
  children: React.ReactNode
  onPlus: () => void
  onMinus: () => void
  plusDisabled: boolean
  minusDisabled: boolean
}) {
  return (
    <div className="flex border border-tr-line bg-tr-raised/60">
      <div className="flex flex-1 min-w-0 flex-col gap-0.5 px-2 py-1.5">
        <span className="flex items-center justify-between text-xs text-tr-muted">
          {label}
          <HelpCircle className="w-3 h-3" aria-hidden="true" />
        </span>
        {children}
      </div>
      <div className="flex w-5 flex-col border-l border-tr-line">
        <button
          type="button"
          onClick={onPlus}
          disabled={plusDisabled}
          aria-label={`Aumentar ${label}`}
          className="flex flex-1 items-center justify-center text-tr-muted hover:text-tr-fg disabled:opacity-30"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onMinus}
          disabled={minusDisabled}
          aria-label={`Diminuir ${label}`}
          className="flex flex-1 items-center justify-center border-t border-tr-line text-tr-muted hover:text-tr-fg disabled:opacity-30"
        >
          <Minus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function TradeButton({
  direction,
  disabled,
  onTrade,
  onHover,
}: {
  direction: "CALL" | "PUT"
  disabled: boolean
  onTrade: (d: "CALL" | "PUT") => void
  onHover: (d: "call" | "put" | null) => void
}) {
  const isCall = direction === "CALL"
  return (
    <button
      type="button"
      onClick={() => onTrade(direction)}
      disabled={disabled}
      onMouseEnter={() => !disabled && onHover(isCall ? "call" : "put")}
      onMouseLeave={() => onHover(null)}
      className={`flex h-[110px] flex-col items-center justify-center gap-2 text-sm font-bold uppercase text-tr-fg transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        isCall ? "bg-tr-up" : "bg-tr-down"
      }`}
    >
      {disabled ? <Lock className="w-6 h-6" aria-hidden="true" /> : <TrendIcon up={isCall} />}
      {isCall ? "Acima" : "Abaixo"}
    </button>
  )
}

function TrendIcon({ up }: { up: boolean }) {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <rect x="2" y={up ? 16 : 10} width="3" height={up ? 6 : 12} fill="currentColor" />
      <rect x="8" y={up ? 12 : 13} width="3" height={up ? 10 : 9} fill="currentColor" />
      <rect x="14" y={up ? 9 : 16} width="3" height={up ? 13 : 6} fill="currentColor" />
      <rect x="20" y={up ? 6 : 19} width="3" height={up ? 16 : 3} fill="currentColor" />
      <path
        d={up ? "M2 12 L10 6 L16 9 L25 2" : "M2 3 L10 9 L16 6 L25 14"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d={up ? "M20 2 H25 V7" : "M20 14 H25 V9"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
