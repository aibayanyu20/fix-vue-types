import path from 'node:path'
import type { AnyNode } from './oxcResolveTypesTypes'

const normalizePathImpl = (path.posix || path).normalize
const windowsSlashRE = /\\/g
const propNameEscapeSymbolsRE = /[ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~\-]/

export function normalizePath(file: string): string {
  return normalizePathImpl(file.replace(windowsSlashRE, '/'))
}

export function inferParserLang(filename: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  const normalized = filename.toLowerCase()
  if (normalized.endsWith('.tsx') || normalized.endsWith('.mtsx')) {
    return 'tsx'
  }
  if (normalized.endsWith('.jsx')) {
    return 'jsx'
  }
  if (normalized.endsWith('.ts') || normalized.endsWith('.d.ts') || normalized.endsWith('.mts') || normalized.endsWith('.cts')) {
    return 'ts'
  }
  return 'js'
}

export function isCallOf(node: AnyNode | null | undefined, name: string): boolean {
  return !!(
    node
    && node.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === name
  )
}

export function getIdentifierName(node: AnyNode | null | undefined): string | undefined {
  if (!node) {
    return
  }

  if (node.type === 'Identifier') {
    return node.name
  }

  if (node.type === 'Literal' && (typeof node.value === 'string' || typeof node.value === 'number')) {
    return String(node.value)
  }

  return
}

export function getQualifiedNameParts(node: AnyNode | null | undefined): string[] {
  if (!node) {
    return []
  }

  if (node.type === 'Identifier') {
    return [node.name]
  }

  if (node.type === 'TSQualifiedName') {
    return [
      ...getQualifiedNameParts(node.left),
      ...getQualifiedNameParts(node.right),
    ]
  }

  return []
}

export function getObjectKey(
  key: AnyNode | null | undefined,
  computed = false,
): string | undefined {
  if (!key) {
    return
  }

  if (!computed && key.type === 'Identifier') {
    return key.name
  }

  if (key.type === 'Literal' && (typeof key.value === 'string' || typeof key.value === 'number')) {
    return String(key.value)
  }

  if (key.type === 'TemplateLiteral' && !key.expressions?.length) {
    return (key.quasis || []).map((quasi: AnyNode) => quasi.value?.cooked ?? quasi.value?.raw ?? '').join('')
  }

  return
}

export function unwrapTypeNode(node: AnyNode | null | undefined): AnyNode | undefined {
  let current = node
  while (current && (current.type === 'TSParenthesizedType' || current.type === 'TSTypeAnnotation')) {
    current = current.type === 'TSParenthesizedType'
      ? current.typeAnnotation
      : current.typeAnnotation
  }
  return current || undefined
}

export function concatStrings(
  values: Array<string | null | undefined | false>,
): string {
  return values.filter((value): value is string => !!value).join(', ')
}

export function toRuntimeTypeString(types: string[]): string {
  if (!types.length) {
    return 'null'
  }
  return types.length === 1 ? types[0] : `[${types.join(', ')}]`
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

export function isRelativeImport(source: string): boolean {
  return source.startsWith('./') || source.startsWith('../') || source.startsWith('/')
}

export function resolveRelativeImportCandidates(
  importerFilename: string,
  source: string,
): string[] {
  const base = path.dirname(importerFilename)
  const resolved = normalizePath(path.resolve(base, source))
  const hasJsExt = /\.(mjs|cjs|js)$/i.test(resolved)
  const resolvedWithoutJsExt = hasJsExt
    ? resolved.replace(/\.(mjs|cjs|js)$/i, '')
    : resolved
  const candidates = [
    `${resolvedWithoutJsExt}.d.ts`,
    `${resolvedWithoutJsExt}.ts`,
    `${resolvedWithoutJsExt}.tsx`,
    `${resolvedWithoutJsExt}.mts`,
    `${resolvedWithoutJsExt}.cts`,
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.d.ts`,
    `${resolved}.mts`,
    `${resolved}.cts`,
    normalizePath(path.join(resolvedWithoutJsExt, 'index.d.ts')),
    normalizePath(path.join(resolvedWithoutJsExt, 'index.ts')),
    normalizePath(path.join(resolvedWithoutJsExt, 'index.tsx')),
    normalizePath(path.join(resolvedWithoutJsExt, 'index.mts')),
    normalizePath(path.join(resolvedWithoutJsExt, 'index.cts')),
    normalizePath(path.join(resolved, 'index.d.ts')),
    normalizePath(path.join(resolved, 'index.ts')),
    normalizePath(path.join(resolved, 'index.tsx')),
    normalizePath(path.join(resolved, 'index.mts')),
    normalizePath(path.join(resolved, 'index.cts')),
  ]

  // Some published d.ts still references source paths like `../pkg/src`.
  // Prefer the emitted declaration folder fallback so type-only resolution keeps working.
  const distFallbackBase = resolvedWithoutJsExt.replace(/\/src(?=\/|$)/, '/dist')
  if (distFallbackBase !== resolvedWithoutJsExt) {
    candidates.push(
      `${distFallbackBase}.d.ts`,
      `${distFallbackBase}.ts`,
      `${distFallbackBase}.tsx`,
      normalizePath(path.join(distFallbackBase, 'index.d.ts')),
      normalizePath(path.join(distFallbackBase, 'index.ts')),
      normalizePath(path.join(distFallbackBase, 'index.tsx')),
      normalizePath(path.join(distFallbackBase, 'interface.d.ts')),
      normalizePath(path.join(distFallbackBase, 'interface.ts')),
    )
  }

  return unique(candidates)
}

export function escapePropName(key: string): string {
  return propNameEscapeSymbolsRE.test(key) ? JSON.stringify(key) : key
}
