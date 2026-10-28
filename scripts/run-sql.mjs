import postgres from "postgres"
import { readFileSync } from "node:fs"

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} })

for (const file of process.argv.slice(2)) {
  try {
    await sql.unsafe(readFileSync(file, "utf8")).simple()
    console.log("OK", file)
  } catch (e) {
    console.log("FAIL", file, "-", e.message)
  }
}
await sql.end()
