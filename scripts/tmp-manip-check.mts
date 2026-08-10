// Verificacao temporaria do sistema de manipulacao. Apagar depois de rodar.
// Usa a API publica do motor (getCandles) com janelas no PASSADO, o que e deterministico.
import { multiAssetEngine, setManipulations, OTC_ASSETS } from "../lib/price-engine/multi-asset-engine.ts"

const SYM = "EURUSD_OTC"
const asset = OTC_ASSETS.find((a) => a.symbol === SYM)!
const TF = 60 as const

const nowCs = Math.floor(Date.now() / 1000 / TF) * TF

function candles(sym: string) {
  return multiAssetEngine.getCandles(sym, TF)
}

const pips = (d: number) => Math.round((d / asset.pipSize) * 10) / 10

// Media do |corpo| das velas: usada para comprovar que a manipulacao nao cria vela vertical.
function avgBody(cs: { open: number; close: number }[]) {
  if (!cs.length) return 0
  return cs.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / cs.length
}

let failures = 0
function check(label: string, ok: boolean, detail: string) {
  if (!ok) failures++
  console.log(`${ok ? "OK   " : "FALHA"} ${label.padEnd(42)} ${detail}`)
}

// Baseline natural (sem nenhuma manipulacao)
setManipulations([])
const base = candles(SYM)
const naturalBody = avgBody(base)
console.log(`velas naturais: ${base.length}  corpo medio=${pips(naturalBody)}pips\n`)

console.log("=== 1. direcao forcada (janela ja concluida, 5 velas) ===")
for (const dir of ["up", "down"] as const) {
  for (const style of ["natural", "suave", "forte", "volatil"] as const) {
    for (const strength of [30, 70, 100]) {
      const startT = nowCs - 12 * TF
      const endT = startT + 5 * TF
      setManipulations([{ symbol: SYM, direction: dir, startTime: startT, endTime: endT, strength, style }])
      const cs = candles(SYM)
      const at = (t: number) => cs.find((c) => c.time === t)
      const cStart = at(startT)
      const cEnd = at(endT - TF)
      if (!cStart || !cEnd) {
        check(`${dir}/${style}/f${strength}`, false, "velas da janela nao encontradas")
        continue
      }
      const moved = cEnd.close - cStart.open
      const ok = dir === "up" ? moved > 0 : moved < 0
      const body = avgBody(cs.filter((c) => c.time >= startT && c.time < endT))
      const ratio = naturalBody > 0 ? body / naturalBody : 0
      check(
        `${dir}/${style}/forca${strength}`,
        ok && ratio < 6,
        `mov=${String(pips(moved)).padStart(7)}pips corpo=${Math.round(ratio * 100) / 100}x natural`,
      )
    }
  }
}

console.log("\n=== 2. congelamento apos o fim (nao volta ao normal) ===")
{
  const startT = nowCs - 12 * TF
  const endT = startT + 4 * TF
  setManipulations([{ symbol: SYM, direction: "up", startTime: startT, endTime: endT, strength: 80, style: "forte" }])
  const cs = candles(SYM)
  const inWin = cs.find((c) => c.time === endT - TF)!
  const after = cs.find((c) => c.time === endT + 3 * TF)!
  const natAfter = base.find((c) => c.time === endT + 3 * TF)!
  // Depois da janela o preco deve continuar DESLOCADO em relacao ao natural (nivel mantido).
  const stillShifted = Math.abs(after.close - natAfter.close) > asset.pipSize * 5
  check("nivel mantido apos o fim", stillShifted, `manip=${after.close} natural=${natAfter.close}`)
  // E nao deve haver salto gigante entre a ultima vela da janela e a seguinte.
  const nextC = cs.find((c) => c.time === endT)!
  const jump = Math.abs(nextC.open - inWin.close)
  check("sem salto no fim da janela", jump < naturalBody * 4, `salto=${pips(jump)}pips`)
}

console.log("\n=== 3. isolamento entre ativos ===")
{
  setManipulations([])
  const otherBase = candles("GBPUSD_OTC")
  setManipulations([{ symbol: SYM, direction: "up", startTime: nowCs - 10 * TF, endTime: nowCs - 5 * TF, strength: 100, style: "forte" }])
  const otherManip = candles("GBPUSD_OTC")
  const same = otherBase.every((c, i) => c.close === otherManip[i]?.close)
  check("GBPUSD_OTC nao afetado", same, same ? "identico" : "DIVERGIU")
}

console.log("\n=== 4. agendada no futuro nao antecipa efeito ===")
{
  setManipulations([{ symbol: SYM, direction: "up", startTime: nowCs + 600, endTime: nowCs + 900, strength: 100, style: "forte" }])
  const cs = candles(SYM)
  const same = base.every((c, i) => c.close === cs[i]?.close)
  check("passado intacto com agendamento", same, same ? "identico ao natural" : "DIVERGIU")
}

console.log("\n=== 5. lista vazia = nenhum efeito ===")
{
  setManipulations([])
  const cs = candles(SYM)
  const same = base.every((c, i) => c.close === cs[i]?.close)
  check("sem manipulacao = natural", same, same ? "identico" : "DIVERGIU")
}

console.log("\n=== 6. determinismo (mesma entrada, mesmo resultado) ===")
{
  const m = [{ symbol: SYM, direction: "up" as const, startTime: nowCs - 8 * TF, endTime: nowCs - 3 * TF, strength: 70, style: "natural" as const }]
  setManipulations(m)
  const a = candles(SYM)
  setManipulations(m)
  const b = candles(SYM)
  const same = a.every((c, i) => c.close === b[i].close && c.high === b[i].high && c.low === b[i].low)
  check("resultado deterministico", same, same ? "identico em 2 execucoes" : "DIVERGIU")
}

console.log("\n=== 7. multiplas manipulacoes no mesmo ativo ===")
{
  setManipulations([
    { symbol: SYM, direction: "up", startTime: nowCs - 20 * TF, endTime: nowCs - 15 * TF, strength: 70, style: "natural" },
    { symbol: SYM, direction: "down", startTime: nowCs - 10 * TF, endTime: nowCs - 5 * TF, strength: 70, style: "natural" },
  ])
  const cs = candles(SYM)
  const up = cs.find((c) => c.time === nowCs - 16 * TF)!
  const upStart = cs.find((c) => c.time === nowCs - 20 * TF)!
  const dnStart = cs.find((c) => c.time === nowCs - 10 * TF)!
  const dn = cs.find((c) => c.time === nowCs - 6 * TF)!
  check("1a janela subiu", up.close > upStart.open, `mov=${pips(up.close - upStart.open)}pips`)
  check("2a janela desceu", dn.close < dnStart.open, `mov=${pips(dn.close - dnStart.open)}pips`)
}

setManipulations([])
console.log(`\nRESULTADO: ${failures === 0 ? "TODOS OS TESTES PASSARAM" : `${failures} FALHA(S)`}`)
