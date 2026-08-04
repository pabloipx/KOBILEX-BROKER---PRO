/**
 * Verificacao temporaria: confirma que as velas reais chegam ao grafico sem alteracao.
 * Busca dados reais da API, injeta no store e compara com o que o motor devolve.
 */
import { setRealCandles, setRealPrice } from "../lib/price-engine/real-price-store.ts"
import { multiAssetEngine } from "../lib/price-engine/multi-asset-engine.ts"

const PORT = process.env.DEV_PORT || "3000"
const SYMBOLS = ["EURUSD", "GBPJPY", "BTCUSD"]

for (const symbol of SYMBOLS) {
  const cr = await fetch(`http://localhost:${PORT}/api/market/crypto?type=candles&symbol=${symbol}&tf=60`)
  const { candles } = await cr.json()
  const pr = await fetch(`http://localhost:${PORT}/api/market/crypto?type=price&symbol=${symbol}`)
  const { price } = await pr.json()

  setRealCandles(symbol, 60, candles)
  setRealPrice(symbol, price)

  const engine = multiAssetEngine.getCandles(symbol, 60)
  const real = candles.slice(-engine.length)

  // Compara o OHLC real com o que o motor entrega ao grafico
  let maxDiff = 0
  let mismatches = 0
  for (let i = 0; i < engine.length; i++) {
    const e = engine[i]
    const r = real[i]
    if (e.time !== r.time) mismatches++
    for (const k of ["open", "high", "low", "close"] as const) {
      // A unica diferenca aceitavel e o arredondamento para as casas exibidas
      maxDiff = Math.max(maxDiff, Math.abs(e[k] - r[k]) / r[k])
    }
  }

  const livePrice = multiAssetEngine.getCurrentPrice(symbol)
  const priceDiff = Math.abs(livePrice - price) / price

  console.log(`\n${symbol}`)
  console.log(`  velas comparadas: ${engine.length} | timestamps divergentes: ${mismatches}`)
  console.log(`  desvio maximo no OHLC: ${(maxDiff * 100).toFixed(6)}%`)
  console.log(`  preco real ${price} -> motor ${livePrice} (desvio ${(priceDiff * 100).toFixed(6)}%)`)
  console.log(`  ultima vela real  : ${JSON.stringify(real[real.length - 1])}`)
  console.log(`  ultima vela motor : ${JSON.stringify(engine[engine.length - 1])}`)
}
