import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6" style={{ backgroundColor: "#0a0a0c" }}>
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 p-6 space-y-6" style={{ backgroundColor: "#131318" }}>
          {/* Header */}
          <div className="flex justify-center">
            <Image
              src="/images/kodilex-logo.png"
              alt="URYN BROKER"
              width={160}
              height={40}
              className="h-10 w-auto"
              unoptimized
            />
          </div>

          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-white">Verifique seu Email</h2>
            <p className="text-white/60 text-sm">
              Enviamos um email de confirmação. Clique no link para ativar sua conta e começar a operar.
            </p>
          </div>

          <Button asChild className="w-full bg-white/10 hover:bg-white/20 text-white h-11">
            <Link href="/auth/login">Voltar para Login</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
