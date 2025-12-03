import type {
  ArrayPattern,
  Identifier,
  ObjectPattern,
  RestElement,
} from '@babel/types'
import type { TypeResolveContext } from './resolveType'
import {
  resolveTypeElements,
  resolveUnionType,
} from './resolveType'

export const DEFINE_EMITS = 'defineEmits'

export function extractRuntimeEmits(ctx: TypeResolveContext): Set<string> {
  const emits = new Set<string>()
  const node = ctx.emitsTypeDecl!

  if (node.type === 'TSFunctionType') {
    extractEventNames(ctx, node.parameters[0], emits)
    return emits
  }

  const { props, calls } = resolveTypeElements(ctx, node)

  let hasProperty = false
  for (const key in props) {
    emits.add(key)
    hasProperty = true
  }

  if (calls) {
    if (hasProperty) {
      ctx.error(
        `defineEmits() type cannot mixed call signature and property syntax.`,
        node,
      )
    }
    for (const call of calls) {
      extractEventNames(ctx, call.parameters[0], emits)
    }
  }

  return emits
}

function extractEventNames(
  ctx: TypeResolveContext,
  eventName: ArrayPattern | Identifier | ObjectPattern | RestElement,
  emits: Set<string>,
) {
  if (
    eventName.type === 'Identifier'
    && eventName.typeAnnotation
    && eventName.typeAnnotation.type === 'TSTypeAnnotation'
  ) {
    const types = resolveUnionType(ctx, eventName.typeAnnotation.typeAnnotation)

    for (const type of types) {
      if (type.type === 'TSLiteralType') {
        if (
          type.literal.type !== 'UnaryExpression'
          && type.literal.type !== 'TemplateLiteral'
        ) {
          emits.add(String(type.literal.value))
        }
      }
    }
  }
}
