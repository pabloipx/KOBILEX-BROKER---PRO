import { createRobotValidateHandlers } from "@/lib/robots-server"
import { TRADER_PRO } from "@/lib/robots"

export const dynamic = "force-dynamic"

export const { GET, POST } = createRobotValidateHandlers({
  robotName: TRADER_PRO.name,
  password: "iabroker",
  minDeposit: TRADER_PRO.minDeposit,
})
