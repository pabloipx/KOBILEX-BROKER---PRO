import type { Metadata } from "next"
import { CustomerChat } from "@/components/support/customer-chat"

export const metadata: Metadata = {
  title: "Suporte",
  description: "Fale com a nossa equipe de atendimento.",
}

export default function SupportPage() {
  return <CustomerChat />
}
