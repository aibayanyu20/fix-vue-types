import type { AnyNode, ResolveTypeContextOptions, ResolveTypeFS, TypeResolveContext } from './oxcResolveTypesTypes'
import { existsSync, readFileSync } from 'node:fs'
import { parseSync } from 'oxc-parser'
import { inferParserLang, normalizePath } from './oxcResolveTypesUtils'

const defaultFS: ResolveTypeFS = {
  fileExists(file) {
    return existsSync(file)
  },
  readFile(file) {
    try {
      return readFileSync(file, 'utf8')
    }
    catch {
      return undefined
    }
  },
}

function formatNodeLocation(node?: AnyNode): string {
  if (!node || typeof node.start !== 'number') {
    return ''
  }
  return ` at ${node.start}`
}

export function createTypeResolveContext(options: ResolveTypeContextOptions): TypeResolveContext {
  const filename = normalizePath(options.filename)
  const source = options.source
  const fs = options.fs ?? defaultFS

  const { program, errors } = parseSync(filename, source, {
    lang: inferParserLang(filename),
    sourceType: 'module',
  })

  if (errors.length) {
    const first = errors[0]!
    throw new Error(
      `[oxc-vue-jsx/resolve-types] Failed to parse ${filename}: ${first.message}`,
    )
  }

  return {
    filename,
    source,
    program: program as AnyNode,
    fs,
    scopeCache: new Map(),
    options,
    getString(node: AnyNode, fileName = filename): string {
      const target = normalizePath(fileName) === filename
        ? source
        : (fs.readFile(fileName) ?? '')
      return target.slice(node.start ?? 0, node.end ?? 0)
    },
    error(message: string, node?: AnyNode, fileName = filename): never {
      throw new Error(
        `[oxc-vue-jsx/resolve-types] ${message} (${fileName}${formatNodeLocation(node)})`,
      )
    },
  }
}
