import type { Metadata } from "next"
import { getStaff } from "@/lib/support/staff"
import { StaffLogin } from "@/components/support/staff/staff-login"
import { SupportDashboard } from "@/components/support/staff/support-dashboard"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Central de Atendimento",
  robots: { index: false, follow: false },
}

// A rota é apenas o ponto de entrada: a sessão da equipe é validada no servidor
// aqui e novamente em cada API de /api/support/staff.
export default async function Admin001Page() {
  const staff = await getStaff()
  if (!staff) return <StaffLogin />
  return <SupportDashboard staff={{ id: staff.id, name: staff.name, email: staff.email, role: staff.role }} />
}
