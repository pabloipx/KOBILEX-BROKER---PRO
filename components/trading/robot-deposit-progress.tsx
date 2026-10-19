import { CheckCircle2, Wallet } from "lucide-react"

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

interface RobotDepositProgressProps {
  totalDeposited: number
  minDeposit: number
  accent: string
  accentTo: string
}

export function RobotDepositProgress({ totalDeposited, minDeposit, accent, accentTo }: RobotDepositProgressProps) {
  const percent = Math.min(100, Math.round((totalDeposited / minDeposit) * 100))
  const missing = Math.max(0, minDeposit - totalDeposited)
  const reached = missing === 0

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {reached ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          ) : (
            <Wallet className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Seus depósitos</span>
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color: reached ? "#34d399" : accent }}>
          {percent}%
        </span>
      </div>

      <p className="mt-3 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-2xl font-black text-white">{brl(totalDeposited)}</span>
        <span className="text-sm text-white/45">de {brl(minDeposit)}</span>
      </p>

      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Progresso do depósito mínimo"
        aria-valuemin={0}
        aria-valuemax={minDeposit}
        aria-valuenow={Math.min(totalDeposited, minDeposit)}
        aria-valuetext={`${brl(totalDeposited)} de ${brl(minDeposit)}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.max(percent, totalDeposited > 0 ? 3 : 0)}%`,
            background: reached ? "linear-gradient(90deg, #34d399, #10b981)" : `linear-gradient(90deg, ${accent}, ${accentTo})`,
            boxShadow: `0 0 12px ${reached ? "#34d399" : accent}88`,
          }}
        />
      </div>

      <p className="mt-3 text-sm text-white/70 text-pretty">
        {reached ? (
          "Depósito mínimo atingido. Sua conta está liberada."
        ) : (
          <>
            Faltam <span className="font-bold text-white">{brl(missing)}</span> em depósitos na conta real para liberar.
          </>
        )}
      </p>
    </div>
  )
}
