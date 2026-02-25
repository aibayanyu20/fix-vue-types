import type { Program } from './ast'
import { parseSync } from 'oxc-parser'

type OxcLang = 'js' | 'jsx' | 'ts' | 'tsx'

export function mapToOxcLang(lang?: string): OxcLang {
  switch (lang) {
    case 'tsx':
    case 'mtsx':
      return 'tsx'
    case 'jsx':
      return 'jsx'
    case 'ts':
    case 'mts':
    case 'cts':
    case 'mcts':
      return 'ts'
    default:
      return 'js'
  }
}

export function parseOxcProgram(
  filename: string,
  source: string,
  lang?: string,
): Program {
  const { program, comments, errors } = parseSync(filename, source, {
    lang: mapToOxcLang(lang),
    sourceType: 'module',
  })

  if (errors.length) {
    const first = errors[0]!
    const err = new Error(first.message) as Error & { pos?: number }
    err.pos = first.labels?.[0]?.start ?? 0
    throw err
  }

  normalizeOxcAst(program as any)
  attachLeadingComments(program as any, comments as any[] | undefined, source)
  return program as unknown as Program
}

function normalizeOxcAst(root: any): void {
  const seen = new WeakSet<object>()
  const queue: any[] = [root]

  while (queue.length) {
    const node = queue.pop()
    if (!node || typeof node !== 'object')
      continue
    if (seen.has(node))
      continue
    seen.add(node)

    normalizeNode(node)

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object')
            queue.push(item)
        }
      }
      else if (value && typeof value === 'object') {
        queue.push(value)
      }
    }
  }
}

function normalizeNode(node: any): void {
  if (node.typeArguments && !node.typeParameters) {
    node.typeParameters = node.typeArguments
  }

  if (
    node.params
    && !node.parameters
    && (
      node.type === 'TSFunctionType'
      || node.type === 'TSMethodSignature'
      || node.type === 'TSCallSignatureDeclaration'
      || node.type === 'TSConstructSignatureDeclaration'
      || node.type === 'TSDeclareFunction'
    )
  ) {
    node.parameters = node.params
  }

  if (
    node.returnType
    && !node.typeAnnotation
    && (
      node.type === 'TSFunctionType'
      || node.type === 'TSMethodSignature'
      || node.type === 'TSCallSignatureDeclaration'
      || node.type === 'TSConstructSignatureDeclaration'
    )
  ) {
    node.typeAnnotation = node.returnType
  }

  switch (node.type) {
    case 'TSTypeParameter': {
      if (node.name && typeof node.name === 'object' && node.name.type === 'Identifier') {
        node.name = node.name.name
      }
      break
    }
    case 'Literal': {
      if (typeof node.value === 'string') {
        node.type = 'StringLiteral'
      }
      else if (typeof node.value === 'number') {
        node.type = 'NumericLiteral'
      }
      else if (typeof node.value === 'boolean') {
        node.type = 'BooleanLiteral'
      }
      else if (node.value === null) {
        node.type = 'NullLiteral'
      }
      break
    }
    case 'Property': {
      if (node.method || node.kind === 'get' || node.kind === 'set') {
        const fn = node.value || {}
        node.type = 'ObjectMethod'
        node.kind = node.kind === 'get' || node.kind === 'set' ? node.kind : 'method'
        node.params = fn.params || []
        node.body = fn.body
        node.async = !!fn.async
        node.generator = !!fn.generator
        node.returnType = fn.returnType ?? null
        node.typeParameters = fn.typeParameters ?? null
      }
      else {
        node.type = 'ObjectProperty'
      }
      break
    }
    case 'PropertyDefinition': {
      node.type = 'ClassProperty'
      break
    }
    case 'MethodDefinition': {
      const fn = node.value || {}
      node.type = 'ClassMethod'
      node.params = fn.params || []
      node.body = fn.body
      node.async = !!fn.async
      node.generator = !!fn.generator
      node.returnType = fn.returnType ?? null
      node.typeParameters = fn.typeParameters ?? null
      break
    }
    case 'TSInterfaceHeritage': {
      node.type = 'TSExpressionWithTypeArguments'
      if (node.typeArguments && !node.typeParameters) {
        node.typeParameters = node.typeArguments
      }
      break
    }
    case 'TSMappedType': {
      if (!node.typeParameter) {
        node.typeParameter = {
          type: 'TSTypeParameter',
          name: node.key?.name,
          constraint: node.constraint,
          start: node.key?.start ?? node.start,
          end: node.constraint?.end ?? node.key?.end ?? node.end,
        }
      }
      break
    }
    case 'TSTypeOperator': {
      if (
        node.operator === 'readonly'
        && (node.typeAnnotation?.type === 'TSArrayType' || node.typeAnnotation?.type === 'TSTupleType')
      ) {
        const inner = node.typeAnnotation
        node.type = inner.type
        for (const [key, value] of Object.entries(inner)) {
          ; (node as any)[key] = value
        }
      }
      break
    }
    case 'TSEnumDeclaration': {
      if (!node.members && node.body?.members) {
        node.members = node.body.members
      }
      break
    }
  }
}

function attachLeadingComments(
  root: any,
  comments: any[] | undefined,
  source: string,
): void {
  if (!comments?.length)
    return

  const nodes: any[] = []
  const seen = new WeakSet<object>()
  const queue: any[] = [root]
  while (queue.length) {
    const node = queue.pop()
    if (!node || typeof node !== 'object')
      continue
    if (seen.has(node))
      continue
    seen.add(node)
    if (typeof node.type === 'string' && typeof node.start === 'number') {
      nodes.push(node)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object')
            queue.push(item)
        }
      }
      else if (value && typeof value === 'object') {
        queue.push(value)
      }
    }
  }

  nodes.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
  const normalizedComments = comments
    .filter(c => typeof c.start === 'number' && typeof c.end === 'number')
    .map((c) => {
      return {
        type: c.type === 'Line' ? 'CommentLine' : 'CommentBlock',
        value: c.value,
        start: c.start,
        end: c.end,
      }
    })
    .sort((a, b) => a.end - b.end)

  let ci = 0
  for (const node of nodes) {
    const attached: any[] = []
    while (ci < normalizedComments.length) {
      const comment = normalizedComments[ci]!
      if (comment.end > node.start) {
        break
      }
      const between = source.slice(comment.end, node.start)
      if (/^[\s,]*$/.test(between)) {
        attached.push(comment)
        ci += 1
      }
      else {
        ci += 1
      }
    }
    if (attached.length) {
      node.leadingComments = (node.leadingComments || []).concat(attached)
    }
  }
}
