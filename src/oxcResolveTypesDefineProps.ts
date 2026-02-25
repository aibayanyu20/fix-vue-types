import type { AnyNode, PropTypeData, TypeResolveContext } from './oxcResolveTypesTypes'
import { inferRuntimeType, resolveTypeElements, UNKNOWN_TYPE } from './oxcResolveTypesResolveType'
import {
  concatStrings,
  escapePropName,
  getObjectKey,
  isCallOf,
  toRuntimeTypeString,
} from './oxcResolveTypesUtils'

export const DEFINE_PROPS = 'defineProps'
export const WITH_DEFAULTS = 'withDefaults'

interface ResolvedDefinePropsCall {
  typeDecl?: AnyNode
  defaultsDecl?: AnyNode
}

export function extractRuntimeProps(
  ctx: TypeResolveContext,
  node: AnyNode,
): PropTypeData[] {
  const resolved = resolveDefinePropsCall(node)
  if (!resolved?.typeDecl) {
    return []
  }

  const elements = resolveTypeElements(ctx, resolved.typeDecl)
  const defaults = getStaticDefaults(ctx, resolved.defaultsDecl)
  const props: PropTypeData[] = []

  for (const [key, element] of Object.entries(elements.props)) {
    let type = inferRuntimeType(
      ctx,
      element.typeNode,
      element.scope,
      element.genericBindings,
    )
    let skipCheck = false

    if (type.includes(UNKNOWN_TYPE)) {
      if (type.includes('Boolean') || type.includes('Function')) {
        type = type.filter(t => t !== UNKNOWN_TYPE)
        skipCheck = true
      }
      else {
        type = ['null']
      }
    }

    const defaultValue = defaults.get(key)
    props.push({
      key,
      type: type.length ? type : ['null'],
      required: defaultValue ? false : !element.optional,
      skipCheck,
      defaultValue,
    })
  }

  return props
}

export function genRuntimeProps(props: PropTypeData[]): string {
  if (!props.length) {
    return '{}'
  }

  const lines = props.map((prop) => {
    return `${escapePropName(prop.key)}: { ${concatStrings([
      `type: ${toRuntimeTypeString(prop.type)}`,
      `required: ${prop.required}`,
      prop.skipCheck && 'skipCheck: true',
      prop.defaultValue && `default: ${prop.defaultValue}`,
    ])} }`
  })

  return `{
  ${lines.join(',\n  ')}
}`
}

function resolveDefinePropsCall(node: AnyNode): ResolvedDefinePropsCall | undefined {
  if (isCallOf(node, DEFINE_PROPS)) {
    return {
      typeDecl: node.typeArguments?.params?.[0],
    }
  }

  if (!isCallOf(node, WITH_DEFAULTS)) {
    return
  }

  const nested = node.arguments?.[0]
  if (!isCallOf(nested, DEFINE_PROPS)) {
    return
  }

  return {
    typeDecl: nested.typeArguments?.params?.[0],
    defaultsDecl: node.arguments?.[1],
  }
}

function getStaticDefaults(
  ctx: TypeResolveContext,
  node: AnyNode | undefined,
): Map<string, string> {
  const defaults = new Map<string, string>()
  if (!node || node.type !== 'ObjectExpression') {
    return defaults
  }

  for (const property of node.properties || []) {
    if (property.type === 'SpreadElement') {
      return new Map()
    }

    if (property.type === 'Property') {
      const key = getObjectKey(property.key, property.computed)
      if (!key || property.kind !== 'init') {
        continue
      }
      defaults.set(key, ctx.getString(property.value))
      continue
    }

    if (property.type === 'ObjectProperty') {
      const key = getObjectKey(property.key, property.computed)
      if (!key) {
        continue
      }
      defaults.set(key, ctx.getString(property.value))
      continue
    }

    if (property.type === 'ObjectMethod') {
      const key = getObjectKey(property.key, property.computed)
      if (!key) {
        continue
      }
      defaults.set(key, ctx.getString(property))
    }
  }

  return defaults
}
