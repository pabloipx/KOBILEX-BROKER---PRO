import { createRobotValidateHandlers } from "@/lib/robots-server"

// Senha validada no servidor para não ficar exposta no bundle.
export const { GET, POST } = createRobotValidateHandlers({ robotName: "OLHO DE CRONOS", password: "cronosvip" })
