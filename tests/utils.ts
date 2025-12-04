import type { CallExpression, Node, ObjectExpression } from '@babel/types'
import * as fs from 'node:fs'
import { BindingTypes } from '@vue/compiler-core'
import { walk } from 'estree-walker'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'
import { extractRuntimeEmits, extractRuntimeProps, ScriptCompileContext } from '../src'
import { recordImports, registerTS } from '../src/resolveType'
import { resolveObjectKey } from '../src/utils'

registerTS(() => ts)

export function compile(
  src: string,
  options: any = {},
): {
  content: string
  bindings?: any
} {
  const { descriptor } = parse(src)
  const ctx = new ScriptCompileContext(descriptor, {
    id: 'test',
    fs: {
      fileExists(file) {
        return fs.existsSync(file)
      },
      readFile(file) {
        return fs.readFileSync(file, 'utf-8')
      },
    },
    ...options,
  })

  const scriptSetupAst = ctx.scriptSetupAst
  const scriptAst = ctx.scriptAst
  const body = [
    ...(scriptAst ? scriptAst.body : []),
    ...(scriptSetupAst ? scriptSetupAst.body : []),
  ]
  ctx.userImports = recordImports(body) as any
  
  // Manually populate scope with local types
  if (!ctx.scope) {
    // @ts-expect-error: accessing private property
    ctx.scope = {
      types: Object.create(null),
      imports: ctx.userImports,
      filename: ctx.filename,
      source: ctx.source,
      offset: 0,
      isGenericScope: false,
      declares: Object.create(null),
      resolvedImportSources: Object.create(null),
    }
  }
  for (const node of body) {
    if (
      node.type === 'TSTypeAliasDeclaration'
      || node.type === 'TSInterfaceDeclaration'
      || node.type === 'TSEnumDeclaration'
    ) {
      // @ts-expect-error: accessing private property
      ctx.scope.types[node.id.name] = node
    }
    else if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id.type === 'Identifier') {
          // @ts-expect-error: accessing private property
          ctx.scope.declares[decl.id.name] = decl
        }
      }
    }
    else if (node.type === 'ClassDeclaration' && node.id) {
      // @ts-expect-error: accessing private property
      ctx.scope.types[node.id.name] = node
      // @ts-expect-error: accessing private property
      ctx.scope.declares[node.id.name] = node
    }
    else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const decl = node.declaration
      if (
        decl.type === 'TSTypeAliasDeclaration'
        || decl.type === 'TSInterfaceDeclaration'
        || decl.type === 'TSEnumDeclaration'
      ) {
        // @ts-expect-error: accessing private property
        ctx.scope.types[decl.id.name] = decl
      }
      else if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations) {
          if (d.id.type === 'Identifier') {
            // @ts-expect-error: accessing private property
            ctx.scope.declares[d.id.name] = d
          }
        }
      }
    }
  }

  // Manually traverse AST to find defineProps/defineEmits and populate context
  if (scriptSetupAst) {
    walk(scriptSetupAst as any, {
      enter(_node: any) {
        const node = _node as Node
        if (
          node.type === 'CallExpression'
          && node.callee.type === 'Identifier'
        ) {
          if (node.callee.name === 'defineProps') {
            handleDefineProps(ctx, node)
          }
          else if (node.callee.name === 'defineEmits') {
            handleDefineEmits(ctx, node)
          }
          else if (node.callee.name === 'withDefaults') {
            handleWithDefaults(ctx, node)
          }
        }
      },
    })
  }

  let content = ''
  if (ctx.propsTypeDecl) {
    const props = extractRuntimeProps(ctx)
    if (props) {
      content += props
    }
  }
  else if (ctx.propsRuntimeDecl) {
    content += ctx.getString(ctx.propsRuntimeDecl)
    // Register bindings for runtime props
    const keys = getObjectOrArrayExpressionKeys(ctx.propsRuntimeDecl)
    for (const key of keys) {
      ctx.bindingMetadata[key] = BindingTypes.PROPS
    }
  }

  if (ctx.emitsTypeDecl) {
    const emits = extractRuntimeEmits(ctx)
    if (emits) {
      content += `\nemits: ${JSON.stringify(Array.from(emits))}`
    }
  }
  else if (ctx.emitsRuntimeDecl) {
    content += `\nemits: ${ctx.getString(ctx.emitsRuntimeDecl)}`
  }

  return {
    content,
    bindings: ctx.bindingMetadata,
  }
}

function handleDefineProps(ctx: ScriptCompileContext, node: CallExpression) {
  ctx.propsCall = node
  if (node.typeParameters) {
    ctx.propsTypeDecl = node.typeParameters.params[0]
  }
  else if (node.arguments.length > 0) {
    ctx.propsRuntimeDecl = node.arguments[0] as Node
  }
}

function handleDefineEmits(ctx: ScriptCompileContext, node: CallExpression) {
  ctx.emitsCall = node
  if (node.typeParameters) {
    ctx.emitsTypeDecl = node.typeParameters.params[0]
  }
  else if (node.arguments.length > 0) {
    ctx.emitsRuntimeDecl = node.arguments[0] as Node
  }
}

function handleWithDefaults(ctx: ScriptCompileContext, node: CallExpression) {
  const firstArg = node.arguments[0] as CallExpression
  if (
    firstArg.type === 'CallExpression'
    && firstArg.callee.type === 'Identifier'
    && firstArg.callee.name === 'defineProps'
  ) {
    handleDefineProps(ctx, firstArg)
    ctx.propsRuntimeDefaults = node.arguments[1] as ObjectExpression
  }
}

export function assertCode(content: string) {
  // Simple validation for now
  if (!content) {
    throw new Error('Generated content is empty')
  }
}

function getObjectOrArrayExpressionKeys(value: Node): string[] {
  if (value.type === 'ArrayExpression') {
    return value.elements
      .map((element) => {
        if (!element || element.type !== 'StringLiteral')
          return ''
        return element.value
      })
      .filter(Boolean)
  }
  if (value.type === 'ObjectExpression') {
    return value.properties
      .map((prop) => {
        if (
          prop.type === 'ObjectProperty'
          || prop.type === 'ObjectMethod'
        ) {
          return resolveObjectKey(prop.key, prop.computed)
        }
        return ''
      })
      .filter((k): k is string => !!k)
  }
  return []
}
