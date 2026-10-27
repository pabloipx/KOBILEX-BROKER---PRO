export interface RobotConfig {
  id: "trader-pro" | "cronos"
  name: string
  titleMain: string
  titleBadge: string
  tagline: string
  image: string
  accent: string
  accentTo: string
  accentSoft: string
  robotAccent: string
  robotAccentTo: string
  apiPath: string
  activeKey: string
  scoreKey: string
  activatedAtKey: string
  changedEvent: string
  scoreSetEvent: string
  minDeposit: number
}

// O TRADER PRO mantém as chaves "kayko_*" para não desativar quem já ativou o robô.
export const TRADER_PRO: RobotConfig = {
  id: "trader-pro",
  name: "TRADER PRO",
  titleMain: "TRADER",
  titleBadge: "PRO",
  tagline: "Analisador de entradas",
  image: "/images/kayko-robot.png",
  accent: "#22d3ee",
  accentTo: "#0891b2",
  accentSoft: "#67e8f9",
  robotAccent: "#F97316",
  robotAccentTo: "#0891b2",
  apiPath: "/api/kayko/validate",
  activeKey: "kayko_robot_active",
  scoreKey: "kayko_score_v1",
  activatedAtKey: "kayko_activated_at",
  changedEvent: "kayko:changed",
  scoreSetEvent: "kayko:score-set",
  minDeposit: 80,
}

export const OLHO_DE_CRONOS: RobotConfig = {
  id: "cronos",
  name: "OLHO DE CRONOS",
  titleMain: "OLHO DE",
  titleBadge: "CRONOS",
  tagline: "Visão do tempo certo da entrada",
  image: "/images/cronos-eye.png",
  accent: "#facc15",
  accentTo: "#d97706",
  accentSoft: "#fde68a",
  robotAccent: "#facc15",
  robotAccentTo: "#d97706",
  apiPath: "/api/cronos/validate",
  activeKey: "cronos_robot_active",
  scoreKey: "cronos_score_v1",
  activatedAtKey: "cronos_activated_at",
  changedEvent: "cronos:changed",
  scoreSetEvent: "cronos:score-set",
  minDeposit: 60,
}

export const TRADE_RESULT_EVENT = "kayko:trade-result"
