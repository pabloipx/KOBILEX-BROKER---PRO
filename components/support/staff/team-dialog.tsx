"use client"

import { useState } from "react"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supportFetch } from "@/lib/support/client"
import type { Agent } from "./types"

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#0B0F14] px-3 text-base text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[#f97316] md:text-sm"

export function TeamDialog({
  open,
  onOpenChange,
  agents,
  onChanged,
  currentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Agent[]
  onChanged: () => void
  currentId: string
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "agent" })
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await supportFetch("/api/support/staff/agents", { method: "POST", body: JSON.stringify(form) })
      toast.success("Atendente cadastrado.")
      setForm({ name: "", email: "", password: "", role: "agent" })
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const update = async (id: string, body: Record<string, unknown>) => {
    setUpdating(id)
    try {
      await supportFetch(`/api/support/staff/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) })
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-[#11161f] text-white">
        <DialogHeader>
          <DialogTitle>Equipe de suporte</DialogTitle>
          <DialogDescription className="text-white/55">
            Cadastre atendentes com login próprio. As senhas são armazenadas com hash e nunca ficam visíveis.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2">
          {agents.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {a.name}
                  {a.id === currentId && <span className="font-normal text-white/40"> (você)</span>}
                </p>
                {a.email && <p className="truncate text-xs text-white/45">{a.email}</p>}
              </div>
              <div className="flex gap-2">
                <select
                  aria-label={`Função de ${a.name}`}
                  value={a.role}
                  disabled={updating === a.id || a.id === currentId}
                  onChange={(e) => update(a.id, { role: e.target.value })}
                  className={fieldClass}
                >
                  <option value="agent">Atendente</option>
                  <option value="admin">Administrador</option>
                </select>
                <button
                  type="button"
                  disabled={updating === a.id || a.id === currentId}
                  onClick={() => update(a.id, { active: !a.active })}
                  className={
                    a.active
                      ? "h-11 shrink-0 rounded-lg bg-emerald-500/15 px-3 text-sm font-medium text-emerald-300 disabled:opacity-50"
                      : "h-11 shrink-0 rounded-lg bg-white/5 px-3 text-sm font-medium text-white/50 disabled:opacity-50"
                  }
                >
                  {updating === a.id ? <Loader2 className="size-4 animate-spin" /> : a.active ? "Ativo" : "Inativo"}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={create} className="flex flex-col gap-2 border-t border-white/[0.06] pt-4">
          <h3 className="text-sm font-semibold">Novo atendente</h3>
          <input
            required
            aria-label="Nome"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={fieldClass}
          />
          <input
            required
            type="email"
            aria-label="Email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={fieldClass}
          />
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            aria-label="Senha"
            placeholder="Senha (mínimo 8 caracteres)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={fieldClass}
          />
          <select
            aria-label="Função"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={fieldClass}
          >
            <option value="agent">Atendente</option>
            <option value="admin">Administrador</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#f97316] text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Cadastrar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
