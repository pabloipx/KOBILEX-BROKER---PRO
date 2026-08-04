// Testa o gatilho de mercado fechado inserindo operacoes reais e conferindo o resultado.
// Usa a service role, que ignora RLS mas NAO ignora gatilhos — exatamente o que queremos provar.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
}

// Pega um usuario existente para satisfazer a FK de user_id.
const uRes = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, { headers })
const users = await uRes.json()
if (!Array.isArray(users) || !users.length) {
  console.log("sem usuarios para testar:", JSON.stringify(users).slice(0, 200))
  process.exit(0)
}
const userId = users[0].id

const inserted = []

async function tryInsert(label, symbol, entry, durationSec) {
  const expiry = new Date(entry.getTime() + durationSec * 1000)
  const body = {
    user_id: userId,
    symbol,
    direction: "up",
    amount: 1,
    entry_price: 1,
    entry_time: entry.toISOString(),
    timeframe: durationSec,
    expiry_time: expiry.toISOString(),
    payout_percentage: 0.9,
    is_demo: true,
    result: "pending",
  }
  const res = await fetch(`${url}/rest/v1/trades`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const out = await res.json()
  if (res.ok) {
    if (Array.isArray(out) && out[0]?.id) inserted.push(out[0].id)
    console.log(`  ${label}\n    -> ACEITO`)
  } else {
    console.log(`  ${label}\n    -> RECUSADO: ${out.message || JSON.stringify(out).slice(0, 120)}`)
  }
}

// Domingo 12:00 UTC = mercado fechado (abre 21:00).
const closedNow = new Date("2026-08-09T12:00:00Z")
// Sexta 20:59 UTC = aberto, mas fecha as 21:00.
const nearClose = new Date("2026-08-07T20:59:00Z")
// Quarta 12:00 UTC = pleno funcionamento.
const openNow = new Date("2026-08-05T12:00:00Z")

console.log("=== ativo de mercado aberto (EURUSD) ===")
await tryInsert("fim de semana, vence em 60s", "EURUSD", closedNow, 60)
await tryInsert("sexta 20:59, vence em 300s (apos o fechamento)", "EURUSD", nearClose, 300)
await tryInsert("sexta 20:59, vence em 30s (antes do fechamento)", "EURUSD", nearClose, 30)
await tryInsert("quarta 12:00, vence em 60s", "EURUSD", openNow, 60)

console.log("=== OTC e cripto (devem operar sempre) ===")
await tryInsert("EURUSD_OTC no fim de semana", "EURUSD_OTC", closedNow, 60)
await tryInsert("BTCUSD no fim de semana", "BTCUSD", closedNow, 60)

// Limpa tudo que o teste inseriu.
for (const id of inserted) {
  await fetch(`${url}/rest/v1/trades?id=eq.${id}`, { method: "DELETE", headers })
}
console.log(`\n(limpeza: ${inserted.length} operacoes de teste removidas)`)
