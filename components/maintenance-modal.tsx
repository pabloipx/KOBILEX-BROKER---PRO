"use client"

import { useEffect } from "react"
import { Wrench, X } from "lucide-react"

// Enquanto o banco de dados estiver indisponível, login e cadastro exibem o aviso de manutenção.
// Para reativar o acesso normal, troque para false.
export const MAINTENANCE_MODE = true

interface MaintenanceModalProps {
  open: boolean
  onClose: () => void
}

export function MaintenanceModal({ open, onClose }: MaintenanceModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-title"
        aria-describedby="maintenance-description"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-amber-100">
          <Wrench className="w-8 h-8 text-amber-600" aria-hidden="true" />
        </div>

        <h2 id="maintenance-title" className="text-xl font-bold text-gray-800 mb-2">
          Corretora em manutenção
        </h2>
        <p id="maintenance-description" className="text-gray-500 text-sm leading-relaxed mb-4">
          Estamos realizando uma manutenção programada para deixar a plataforma ainda melhor para você. Durante este
          período, o acesso e a criação de novas contas estão temporariamente indisponíveis.
        </p>

        <ul className="text-left text-sm text-gray-600 space-y-2 mb-4 rounded-lg bg-gray-50 p-4">
          <li className="flex gap-2">
            <span className="text-green-600 font-bold" aria-hidden="true">•</span>
            Pagamentos mais rápidos e seguros em depósitos e saques
          </li>
          <li className="flex gap-2">
            <span className="text-green-600 font-bold" aria-hidden="true">•</span>
            Mais velocidade na execução das operações
          </li>
          <li className="flex gap-2">
            <span className="text-green-600 font-bold" aria-hidden="true">•</span>
            Correção de lentidão e instabilidades do sistema
          </li>
          <li className="flex gap-2">
            <span className="text-green-600 font-bold" aria-hidden="true">•</span>
            Reforço de segurança e correção de vulnerabilidades
          </li>
        </ul>

        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Seus dados e saldos estão seguros. Por favor, tente novamente mais tarde.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-md text-white font-semibold bg-green-600 hover:bg-green-700 transition-colors"
        >
          Entendi
        </button>
      </div>
    </div>
  )
}
