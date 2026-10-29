import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"

export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="bt-gradient bt-shadow-glow inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold text-bt-fg transition-transform hover:scale-105"
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  )
}
