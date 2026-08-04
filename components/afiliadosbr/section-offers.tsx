"use client"

import { useState } from "react"
import { Check, ChevronUp, Copy, Laptop, Smartphone, Tablet } from "lucide-react"
import { brl, type AffiliateInfo } from "./types"

interface SectionOffersProps {
  affiliate: AffiliateInfo
}

export function SectionOffers({ affiliate }: SectionOffersProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const revenueLink = `${origin}/?ref=${affiliate.code}`
  const cpaLink = `${origin}/auth/sign-up?ref=${affiliate.code}`

  const copy = async (id: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  const offers = [
    {
      id: "revenue",
      title: `URYN · ${affiliate.commission_rate}% · Revenue Share`,
      rate: `${affiliate.commission_rate}%`,
      link: revenueLink,
    },
    {
      id: "cpa",
      title: "URYN · R$ 100 · CPA",
      rate: brl(100),
      link: cpaLink,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="text-[15px] text-gray-600">Ofertas ativas</span>
        <span className="h-px flex-1 bg-gray-200" />
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500">
          <ChevronUp className="h-4 w-4" />
        </span>
      </div>

      {offers.map((offer) => (
        <section key={offer.id} className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-orange-400">
                UB
              </span>
              <div>
                <p className="text-[17px] font-medium text-gray-900">{offer.title}</p>
                <p className="text-[15px] text-emerald-600">Ativa</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => copy(offer.id, offer.link)}
              className="flex h-11 items-center gap-2 rounded-lg bg-emerald-400 px-5 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500"
            >
              {copied === offer.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === offer.id ? "Link copiado" : "Obtenha um link"}
            </button>
          </div>

          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Taxa atual</th>
                  <th className="px-6 py-3 font-medium">Plataformas</th>
                  <th className="px-6 py-3 font-medium">Saldo</th>
                  <th className="px-6 py-3 font-medium">Região</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-gray-800">
                <tr>
                  <td className="px-6 py-4 font-medium">{offer.rate}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Smartphone className="h-4 w-4" />
                      <Tablet className="h-4 w-4" />
                      <Laptop className="h-4 w-4" />
                    </span>
                  </td>
                  <td className="px-6 py-4">{brl(affiliate.balance)}</td>
                  <td className="px-6 py-4">Brasil (LATAM)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-6 py-4">
            <code className="flex-1 truncate rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
              {offer.link}
            </code>
          </div>
        </section>
      ))}
    </div>
  )
}
