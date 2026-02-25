import type { AnyNode, TypeResolveContext } from './oxcResolveTypesTypes'
import { resolveTypeElements, resolveUnionType } from './oxcResolveTypesResolveType'
import { getObjectKey, isCallOf } from './oxcResolveTypesUtils'

export const DEFINE_EMITS = 'defineEmits'

export function extractRuntimeEmits(
  ctx: TypeResolveContext,
  node: AnyNode,
): Set<string> {
  if (!isCallOf(node, DEFINE_EMITS)) {
    return new Set()
  }

  const typeDecl = node.typeArguments?.params?.[0]
  if (!typeDecl) {
    return extractRuntimeEmitsFromRuntimeDecl(node.arguments?.[0])
  }

  const emits = new Set<string>()

  if (typeDecl.type === 'TSFunctionType') {
    extractEventNames(ctx, typeDecl.params?.[0], emits)
    return emits
  }

  const { props, calls } = resolveTypeElements(ctx, typeDecl)
  const propKeys = Object.keys(props)

  for (const key of propKeys) {
    emits.add(key)
  }

  if (calls.length && propKeys.length) {
    ctx.error('defineEmits() type cannot mix call signature and property syntax.', typeDecl)
  }

  for (const call of calls) {
    extractEventNames(ctx, call.parameters[0], emits)
  }

  return emits
}

export function genRuntimeEmits(emits: Iterable<string>): string {
  const names = [...emits]
  return `[${names.map(name => JSON.stringify(name)).join(', ')}]`
}

function extractEventNames(
  ctx: TypeResolveContext,
  eventParameter: AnyNode | undefined,
  emits: Set<string>,
): void {
  const annotation = eventParameter?.typeAnnotation?.typeAnnotation
  if (!annotation) {
    return
  }

  const types = resolveUnionType(ctx, annotation)
  for (const type of types) {
    if (type.type !== 'TSLiteralType') {
      continue
    }

    const literal = type.literal
    if (!literal) {
      continue
    }

    if (literal.type === 'Literal' && (typeof literal.value === 'string' || typeof literal.value === 'number')) {
      emits.add(String(literal.value))
      continue
    }

    if (literal.type === 'TemplateLiteral' && !literal.expressions?.length) {
      const name = (literal.quasis || []).map((quasi: AnyNode) => quasi.value?.cooked ?? quasi.value?.raw ?? '').join('')
      if (name) {
        emits.add(name)
      }
    }
  }
}

function extractRuntimeEmitsFromRuntimeDecl(node: AnyNode | undefined): Set<string> {
  const emits = new Set<string>()
  if (!node) {
    return emits
  }

  if (node.type === 'ArrayExpression') {
    for (const element of node.elements || []) {
      if (element?.type === 'Literal' && (typeof element.value === 'string' || typeof element.value === 'number')) {
        emits.add(String(element.value))
      }
    }
    return emits
  }

  if (node.type === 'ObjectExpression') {
    for (const property of node.properties || []) {
      if (property.type === 'SpreadElement') {
        continue
      }
      const key = getObjectKey(property.key, property.computed)
      if (key) {
        emits.add(key)
      }
    }
  }

  return emits
}
