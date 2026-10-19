import { createRobotValidateHandlers } from "@/lib/robots-server"
import { OLHO_DE_CRONOS } from "@/lib/robots"

export const dynamic = "force-dynamic"

export const { GET, POST } = createRobotValidateHandlers({
  robotName: OLHO_DE_CRONOS.name,
  password: "cronosvip",
  minDeposit: OLHO_DE_CRONOS.minDeposit,
})
