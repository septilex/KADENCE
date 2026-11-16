// Run repository TypeScript in Node tests without adding a second build toolchain.
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

registerHooks({
  resolve(specifier, context, nextResolve) {
    let candidate
    if (specifier.startsWith('@/')) candidate = path.resolve(specifier.slice(2))
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    if (candidate && !path.extname(candidate)) {
      for (const ext of ['.ts', '.tsx', '.js']) if (existsSync(candidate + ext)) return nextResolve(pathToFileURL(candidate + ext).href, context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') && !url.includes('/node_modules/')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText,
    }
    return nextLoad(url, context)
  },
})
