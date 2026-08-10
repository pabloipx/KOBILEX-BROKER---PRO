// Resolver temporario: permite importar modulos .ts sem extensao (estilo bundler).
// Apagar junto com tmp-manip-check.mts.
import { existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, resolve as resolvePath } from "node:path"

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[mc]?[jt]s$/.test(specifier)) {
    const base = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd()
    for (const cand of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      const abs = resolvePath(base, cand)
      if (existsSync(abs)) return next(pathToFileURL(abs).href, context)
    }
  }
  return next(specifier, context)
}
